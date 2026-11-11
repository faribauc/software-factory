import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { cn } from "cn"
import { useEffect } from "react"
import {
  Ago, Dash, Empty, Flow, Header, Meta, Panel, ProjectLink, RunsChart, Spark, Stat, Status, THREAD, ThreadStatus,
  failing, gh, ghError, issuesOf, mergedOf, prsOf, stageInfo,
} from "@/components/dashboard"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { dur, pct, plural, within } from "@/lib/format"
import { useLive } from "@/routes/__root"
import type { Project } from "@/server/state"

export const Route = createFileRoute("/")({ component: Overview })

type Item = { kind: string; tone: string; title: string; url?: string; p: Project; when: string }
const RANK = ["needs you", "needs human", "failed", "failing", "conflict", "changes requested", "ready", "needs info"]

/** What's waiting on the user across projects, most urgent first. */
function attention(projects: Project[]) {
  const items: Item[] = []
  for (const p of projects) {
    for (const t of p.threads) {
      if (t.state === "needs-you" || t.state === "failed" || t.state === "ready")
        items.push({ kind: THREAD[t.state][0], tone: THREAD[t.state][1], title: t.title, p, when: t.updated })
    }
    for (const pr of prsOf(p)) {
      const kind = failing(pr) ? "failing" : pr.mergeable === "CONFLICTING" ? "conflict"
        : pr.reviewDecision === "CHANGES_REQUESTED" ? "changes requested" : null
      if (kind) items.push({ kind, tone: "bg-critical", title: `#${pr.number} ${pr.title}`, url: pr.url, p, when: pr.updatedAt })
    }
    for (const i of issuesOf(p)) {
      if (i.stage === "needs-human" || i.stage === "needs-info") {
        const [, name, tone] = stageInfo(i.stage)
        items.push({ kind: name.toLowerCase(), tone, title: `#${i.number} ${i.title}`, url: i.url, p, when: i.updatedAt })
      }
    }
  }
  return items.sort((a, b) => RANK.indexOf(a.kind) - RANK.indexOf(b.kind) || b.when.localeCompare(a.when))
}

const lastActive = (p: Project) => p.threads.reduce((m, t) => (t.updated > m ? t.updated : m), "")

function Overview() {
  const { state } = useLive()
  const ps = state.projects, s = state.stats
  const threads = ps.flatMap(p => p.threads), issues = ps.flatMap(issuesOf)
  const prs = ps.flatMap(prsOf), merged = ps.flatMap(mergedOf)
  const n = (st: string) => threads.filter(t => t.state === st).length
  const waiting = n("needs-you") + n("ready") + issues.filter(i => i.stage === "needs-human").length
  const items = attention(ps)
  const navigate = useNavigate()
  useEffect(() => { document.title = "Factory" }, [])

  return (
    <>
      <Header>
        <h1 className="text-xl font-semibold">Factory</h1>
        <Meta>{plural(ps.length, "project")}</Meta>
      </Header>
      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-[1.4fr_repeat(4,1fr)]">
        <Stat hero label="Waiting on you" value={waiting} className="col-span-2 sm:col-span-1 sm:row-span-2 xl:row-span-1"
          sub={<><span>{n("needs-you")} need you</span><span>{n("ready")} to review</span></>} />
        <Stat label="Runs, 7 days" value={s.runs7} sub={`${pct(s.failRate30)} failed (30d)`}><Spark daily={s.daily} /></Stat>
        <Stat label="Agent time, 7 days" value={dur(s.agent7)} sub={`median run ${dur(s.median30)}`} />
        <Stat label="Open PRs" value={prs.length}
          sub={prs.some(failing) ? <Status label={`${prs.filter(failing).length} failing`} tone="bg-critical" /> : "none failing"} />
        <Stat label="Merged, 7 days" value={merged.filter(m => within(m.mergedAt, 7)).length}
          sub={`${merged.filter(m => within(m.mergedAt, 30)).length} in 30 days`} />
      </div>
      <Panel title="Issue flow" meta={`all projects · ${plural(issues.length, "issue")} tracked`} className="mb-3">
        <Flow issues={issues} />
      </Panel>
      <div className="mb-3 grid gap-3 md:grid-cols-2">
        <Panel title="Runs per day" meta="last 14 days"><RunsChart daily={s.daily} /></Panel>
        <Panel title="Waiting on you" meta={plural(waiting, "item")}>
          {items.length ? (
            <ul>
              {items.slice(0, 8).map((x, k) => (
                <li key={k} className="grid grid-cols-[1fr_auto] items-baseline gap-x-2.5 border-b py-1.5 last:border-0 sm:grid-cols-[96px_1fr_auto]">
                  <Status label={x.kind} tone={x.tone} className="col-span-2 sm:col-span-1" />
                  <span className="min-w-0 truncate text-sm">
                    {x.url ? <a href={x.url} className="hover:underline">{x.title}</a> : x.title} <Meta>{x.p.title}</Meta>
                  </span>
                  <Ago iso={x.when} />
                </li>
              ))}
            </ul>
          ) : <Empty>Nothing is waiting on you.</Empty>}
          {items.length > 8 && <Meta>{items.length - 8} more</Meta>}
        </Panel>
      </div>
      <Panel title="Projects" meta={ps.length}>
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead className="text-muted-foreground">Project</TableHead>
              <TableHead className="text-muted-foreground">Runs (7d)</TableHead>
              <TableHead className="text-muted-foreground">Threads</TableHead>
              <TableHead className="text-muted-foreground">Issues</TableHead>
              <TableHead className="text-right text-muted-foreground">Open PRs</TableHead>
              <TableHead className="text-right text-muted-foreground">Merged (30d)</TableHead>
              <TableHead className="text-right text-muted-foreground">Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ps.map(p => {
              const open = p.threads.filter(t => t.state !== "done")
              const iss = issuesOf(p), openIss = iss.filter(i => i.stage !== "done"), pp = prsOf(p)
              const flagged = open.find(t => t.state === "needs-you") ?? open.find(t => t.state === "failed")
              const quiet = !open.length && !openIss.length && !pp.length && !p.stats.runs7
              const active = lastActive(p)
              return (
                <TableRow key={p.id} className={cn("cursor-pointer", quiet && "text-muted-foreground")}
                  onClick={e => { if (!(e.target as HTMLElement).closest("a")) navigate({ to: "/p/$projectId", params: { projectId: p.id } }) }}>
                  <TableCell className="max-w-[220px] truncate">
                    <ProjectLink p={p} className="font-semibold hover:underline">{p.title}</ProjectLink>
                    <Meta className="block truncate" >{p.repo ?? "local only"}</Meta>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-end gap-2 tabular-nums"><Spark daily={p.stats.daily} w={70} h={18} />{p.stats.runs7}</span>
                  </TableCell>
                  <TableCell>{flagged ? <ThreadStatus state={flagged.state} /> : open.length ? `${open.length} active` : <Dash />}</TableCell>
                  <TableCell>
                    {ghError(p.github) ? <Status label="GitHub error" tone="bg-critical" />
                      : !p.repo ? <Dash /> : openIss.length ? `${openIss.length} open` : <Meta>0 open</Meta>}
                    {iss.length > openIss.length && <Meta className="block">{iss.length - openIss.length} done</Meta>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {pp.length}{pp.some(failing) && <Status className="ml-1.5" label={`${pp.filter(failing).length} failing`} tone="bg-critical" />}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{gh(p) ? mergedOf(p).filter(m => within(m.mergedAt, 30)).length : <Dash />}</TableCell>
                  <TableCell className="text-right">{active ? <Ago iso={active} /> : <Dash />}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Panel>
    </>
  )
}
