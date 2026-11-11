// Builds the dashboard state on the server: T3's database, read-only, and GitHub through `gh`. Writes nothing.
import "@tanstack/react-start/server-only"
import { execFile } from "node:child_process"
import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { promisify } from "node:util"
import {
  checks, issueStage, runStats, threadState,
  type Checks, type Run, type Stage, type Stats, type ThreadState,
} from "@/lib/factory"

const run = promisify(execFile)
const DB = join(process.env.T3_HOME ?? join(homedir(), ".t3"), "userdata", "statev2.sqlite")
const GH_TTL = 120_000 // ms; one GraphQL call per repo per TTL keeps well under the rate limit
const GH_QUERY = `
query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) {
  issues(states: OPEN, first: 30, orderBy: {field: UPDATED_AT, direction: DESC}) {
    nodes { number title url updatedAt labels(first: 10) { nodes { name } } } }
  closed: issues(states: CLOSED, first: 20, orderBy: {field: UPDATED_AT, direction: DESC}) {
    nodes { number title url updatedAt closedAt labels(first: 10) { nodes { name } } } }
  open: pullRequests(states: OPEN, first: 30, orderBy: {field: UPDATED_AT, direction: DESC}) {
    nodes { number title url isDraft headRefName reviewDecision mergeable updatedAt
            closingIssuesReferences(first: 5) { nodes { number } }
            commits(last: 1) { nodes { commit { statusCheckRollup { state } } } } } }
  merged: pullRequests(states: MERGED, first: 30, orderBy: {field: UPDATED_AT, direction: DESC}) {
    nodes { number title url mergedAt } }
} }`

export type Thread = {
  id: string
  title: string
  updated: string
  state: ThreadState
  branch: string | null
  prs: { number: number; url: string; state: string | null }[]
}
export type PullRequest = {
  number: number
  title: string
  url: string
  isDraft: boolean
  reviewDecision: string | null
  mergeable: string
  updatedAt: string
  checks: Checks
  closes: number[]
}
export type IssuePr = Pick<PullRequest, "number" | "url" | "isDraft" | "checks" | "reviewDecision" | "mergeable">
export type Issue = {
  number: number
  title: string
  url: string
  updatedAt: string
  closedAt?: string
  labels: string[]
  stage: Stage
  pr: IssuePr | null
  thread: Pick<Thread, "id" | "title" | "state"> | null
}
export type GitHub =
  | { error: string }
  | { issues: Issue[]; prs: PullRequest[]; merged: { number: number; title: string; url: string; mergedAt: string }[] }
export type Project = {
  id: string
  title: string
  repo: string | null
  threads: Thread[]
  github: GitHub | null
  stats: Stats
}
export type State = { generatedAt: string; stats: Stats; projects: Project[] }

type Row = Record<string, string | null>

/**
 * Projects, threads and runs from T3's database.
 *
 * lean: T3's schema is internal, not an API. Everything that reads it is in
 * this one function, so a T3 update that changes it breaks only this.
 */
function t3Projects() {
  const db = new DatabaseSync(DB, { readOnly: true })
  try {
    const all = (sql: string) => db.prepare(sql).all() as Row[]
    const projects = new Map(
      all("select project_id, title, workspace_root from projection_projects where deleted_at is null").map(r => [
        r.project_id!,
        { id: r.project_id!, title: r.title!, root: r.workspace_root!, threads: [] as Thread[], runs: [] as Run[] },
      ]),
    )
    const latestRun = new Map(all(
      "select thread_id, status from orchestration_v2_projection_runs r where ordinal ="
      + " (select max(ordinal) from orchestration_v2_projection_runs where thread_id = r.thread_id)",
    ).map(r => [r.thread_id!, r.status!]))
    const waiting = new Set(all(
      "select thread_id from orchestration_v2_projection_runtime_requests where status not in ('resolved', 'cancelled')",
    ).map(r => r.thread_id))
    for (const r of all(
      "select t.project_id, r.status, r.provider,"
      + " coalesce(json_extract(r.payload_json, '$.startedAt'), r.requested_at) as start, r.completed_at as end"
      + " from orchestration_v2_projection_runs r join orchestration_v2_projection_threads t using (thread_id)"
      + " where t.deleted_at is null",
    )) {
      // every thread counts here, archived and child threads included
      projects.get(r.project_id!)?.runs.push({ status: r.status!, provider: r.provider!, start: r.start, end: r.end })
    }
    for (const r of all(
      "select thread_id, project_id, title, updated_at, payload_json from orchestration_v2_projection_threads"
      + " where deleted_at is null and archived_at is null and thread_id not in"
      + " (select child_thread_id from orchestration_v2_projection_subagents where child_thread_id is not null)"
      + " order by updated_at desc",
    )) {
      const project = projects.get(r.project_id!)
      if (!project) continue
      const p = JSON.parse(r.payload_json!)
      project.threads.push({
        id: r.thread_id!,
        title: r.title!,
        updated: r.updated_at!,
        state: threadState(latestRun.get(r.thread_id!), waiting.has(r.thread_id), Boolean(p.settledAt)),
        branch: p.branch ?? null,
        prs: (p.pullRequests ?? []).map((pr: { number: number; url: string; snapshot?: { state?: string } }) =>
          ({ number: pr.number, url: pr.url, state: pr.snapshot?.state ?? null })),
      })
    }
    return [...projects.values()]
  } finally {
    db.close()
  }
}

async function githubSlug(root: string) {
  if (!existsSync(root)) return null
  try {
    const { stdout } = await run("git", ["-C", root, "remote", "get-url", "origin"])
    const m = stdout.trim().match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?\/?$/)
    return m ? `${m[1]}/${m[2]}` : null
  } catch {
    return null // no origin remote
  }
}

const ghCache = new Map<string, { at: number; data: GitHub }>()

async function github(slug: string): Promise<GitHub> {
  const cached = ghCache.get(slug)
  if (cached && Date.now() - cached.at < GH_TTL) return cached.data
  const [owner, name] = slug.split("/", 2)
  let stdout: string
  try {
    ;({ stdout } = await run("gh", ["api", "graphql", "-f", `query=${GH_QUERY}`, "-f", `owner=${owner}`, "-f", `name=${name}`],
      { timeout: 30_000, maxBuffer: 16 * 1024 * 1024 }))
  } catch (e) {
    const err = e as { stderr?: string }
    return { error: err.stderr?.trim().split("\n").at(-1) || "gh failed" } // not cached: retry next poll
  }
  const repo = JSON.parse(stdout).data.repository
  const prs: PullRequest[] = repo.open.nodes.map(({ commits, closingIssuesReferences, ...pr }: any) => ({
    ...pr, checks: checks(commits), closes: closingIssuesReferences.nodes.map((i: { number: number }) => i.number),
  }))
  const closer = new Map(prs.flatMap(pr => pr.closes.map(n => [n, pr] as const)))
  const issues: Issue[] = [...repo.issues.nodes, ...repo.closed.nodes].map(({ labels: l, ...i }: any) => {
    const labels: string[] = l.nodes.map((x: { name: string }) => x.name)
    const pr = i.closedAt ? undefined : closer.get(i.number)
    return {
      ...i, labels, stage: issueStage(labels, Boolean(i.closedAt), Boolean(pr)), thread: null,
      pr: pr ? { number: pr.number, url: pr.url, isDraft: pr.isDraft, checks: pr.checks, reviewDecision: pr.reviewDecision, mergeable: pr.mergeable } : null,
    }
  })
  const data: GitHub = { issues, prs, merged: repo.merged.nodes }
  ghCache.set(slug, { at: Date.now(), data })
  return data
}

export async function buildState(): Promise<State> {
  const now = Date.now() / 1000
  const raw = t3Projects()
  const projects = await Promise.all(raw.map(async ({ runs, root, ...p }) => {
    const repo = await githubSlug(root)
    let gh = repo ? await github(repo) : null
    const byPr = new Map<string, Thread>()
    for (const t of [...p.threads].reverse()) for (const pr of t.prs) byPr.set(pr.url, t) // newest thread wins
    if (gh && "issues" in gh) { // copy: the cached object may be shared with another project
      gh = { ...gh, issues: gh.issues.map(i => {
        const t = i.pr && byPr.get(i.pr.url)
        return { ...i, thread: t ? { id: t.id, title: t.title, state: t.state } : null }
      }) }
    }
    return { ...p, repo, github: gh, stats: runStats(runs, now) }
  }))
  const lastActive = (p: Project) => p.threads.reduce((m, t) => (t.updated > m ? t.updated : m), "")
  projects.sort((a, b) => lastActive(b).localeCompare(lastActive(a)))
  return { generatedAt: new Date().toISOString(), stats: runStats(raw.flatMap(p => p.runs), now), projects }
}
