import { Link, createFileRoute } from "@tanstack/react-router"
import { cn } from "cn"
import { useEffect } from "react"
import {
  Ago, CheckStatus, Dash, Empty, FLOW_LABELS, Flow, Header, Meta, Panel, PrFlags, ProviderSplit, RunsChart, STAGES,
  Spark, Stat, Status, THREAD_ORDER, ThreadStatus, ghError, hasFlags, issuesOf, mergedOf, prsOf,
} from "@/components/dashboard"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { dur, pct, plural, within } from "@/lib/format"
import { useLive } from "@/routes/__root"
import type { Project } from "@/server/state"

export const Route = createFileRoute("/p/$projectId")({ component: ProjectPage })

function ProjectPage() {
  const { projectId } = Route.useParams()
  const p = useLive().state.projects.find(x => x.id === projectId)
  useEffect(() => { document.title = p ? `${p.title} · Factory` : "Factory" }, [p?.title])
  return (
    <>
      <Header>
        <div className="text-xl font-semibold">
          <Link to="/" className="font-medium text-muted-foreground hover:underline">Factory</Link>
          <span className="mx-1.5 font-normal text-muted-foreground">/</span>
          {p ? p.title : "Unknown project"}
        </div>
        {p?.repo && <a href={`https://github.com/${p.repo}`} className="text-xs text-muted-foreground hover:underline">{p.repo}</a>}
      </Header>
      {p ? <ProjectView p={p} /> : (
        <Empty>Project not found. <Link to="/" className="underline">Back to all projects</Link></Empty>
      )}
    </>
  )
}

const Th = ({ children, right }: { children: string; right?: boolean }) => (
  <TableHead className={cn("text-xs text-muted-foreground", right && "text-right")}>{children}</TableHead>
)

function ProjectView({ p }: { p: Project }) {
  const s = p.stats, iss = issuesOf(p), prs = prsOf(p), error = ghError(p.github)
  const threads = [...p.threads].sort((a, b) => THREAD_ORDER.indexOf(a.state) - THREAD_ORDER.indexOf(b.state))
  const lanes = STAGES.filter(([k]) => iss.some(i => i.stage === k))
  return (
    <>
      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Stat label="Runs, 7 days" value={s.runs7} sub={`${s.runs30} in 30 days`}><Spark daily={s.daily} /></Stat>
        <Stat label="Agent time, 30 days" value={dur(s.agent30)} sub={`${dur(s.agent7)} in 7 days`} />
        <Stat label="Median run" value={dur(s.median30)} sub="30 days" />
        <Stat label="Runs failed, 30 days" value={pct(s.failRate30)} sub="failed or interrupted" />
        <Stat label="Issues closed, 30 days" value={iss.filter(i => i.stage === "done" && within(i.closedAt, 30)).length}
          sub={`${iss.filter(i => i.stage !== "done").length} open`} />
        <Stat label="PRs merged, 30 days" value={mergedOf(p).filter(m => within(m.mergedAt, 30)).length} sub={`${prs.length} open`} />
      </div>

      <Panel title="Issues" meta={p.repo ? `${plural(iss.length, "issue")} tracked` : "not a GitHub repository"} className="mb-3">
        {error && <p className="mb-2"><Status label={`GitHub: ${error}`} tone="bg-critical" className="whitespace-normal" /></p>}
        {p.repo && <Flow issues={iss} />}
        {lanes.length > 0 && (
          <div className="mt-3 grid auto-cols-[minmax(220px,300px)] grid-flow-col gap-2.5 overflow-x-auto pb-1">
            {lanes.map(([k, name, tone]) => {
              const items = iss.filter(i => i.stage === k), shown = k === "done" ? items.slice(0, 6) : items
              return (
                <div key={k} className="flex min-w-0 flex-col gap-2 rounded-lg bg-background p-2.5">
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap">
                    <Status tone={tone} />{name}<Meta className="ml-auto font-normal">{items.length}</Meta>
                  </h3>
                  {shown.map(i => {
                    const extra = i.labels.filter(l => !FLOW_LABELS.has(l))
                    return (
                      <div key={i.number} className="flex flex-col gap-1.5 rounded-lg bg-card p-2.5 text-sm ring-1 ring-foreground/10">
                        <a href={i.url} title={i.title} className="line-clamp-3 hover:underline"><Meta>#{i.number}</Meta> {i.title}</a>
                        {(i.pr || i.thread || extra.length > 0) && (
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                            {i.pr && <>
                              <a href={i.pr.url} className="text-xs text-muted-foreground hover:underline">PR #{i.pr.number}</a>
                              <CheckStatus pr={i.pr} /><PrFlags pr={i.pr} />
                            </>}
                            {i.thread && <span title={i.thread.title}><ThreadStatus state={i.thread.state} /></span>}
                            {extra.map(l => <Meta key={l}>{l}</Meta>)}
                          </div>
                        )}
                        <Ago iso={i.closedAt ?? i.updatedAt} prefix={k === "done" ? "closed " : "updated "} />
                      </div>
                    )
                  })}
                  {items.length > shown.length && <Meta>{items.length - shown.length} more</Meta>}
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      <div className="mb-3 grid gap-3 md:grid-cols-2">
        <Panel title="Runs per day" meta="last 14 days"><RunsChart daily={s.daily} /></Panel>
        <Panel title="Runs by provider" meta="last 30 days"><ProviderSplit counts={s.providers30} /></Panel>
      </div>

      <Panel title="Pull requests" meta={`${prs.length} open`} className="mb-3">
        {prs.length ? (
          <Table>
            <TableHeader><TableRow><Th>Checks</Th><Th>Pull request</Th><Th>Review</Th><Th right>Updated</Th></TableRow></TableHeader>
            <TableBody>
              {prs.map(pr => (
                <TableRow key={pr.number}>
                  <TableCell><CheckStatus pr={pr} /></TableCell>
                  <TableCell className="min-w-[180px] whitespace-normal"><a href={pr.url} className="hover:underline">#{pr.number} {pr.title}</a></TableCell>
                  <TableCell><span className="flex gap-2.5">{hasFlags(pr) ? <PrFlags pr={pr} /> : <Dash />}</span></TableCell>
                  <TableCell className="text-right"><Ago iso={pr.updatedAt} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : <Empty>No open pull requests.</Empty>}
      </Panel>

      <Panel title="Threads" meta={threads.length}>
        {threads.length ? (
          <Table>
            <TableHeader><TableRow><Th>State</Th><Th>Thread</Th><Th>Branch</Th><Th>PR</Th><Th right>Updated</Th></TableRow></TableHeader>
            <TableBody>
              {threads.map(t => {
                const open = t.prs.filter(pr => pr.state === "open")
                return (
                  <TableRow key={t.id} className={cn(t.state === "done" && "text-muted-foreground")}>
                    <TableCell><ThreadStatus state={t.state} /></TableCell>
                    <TableCell className="min-w-[180px] whitespace-normal">{t.title}</TableCell>
                    <TableCell><Meta>{t.branch ?? "–"}</Meta></TableCell>
                    <TableCell>
                      {open.length ? open.map(pr => <a key={pr.url} href={pr.url} className="mr-1.5 hover:underline">#{pr.number}</a>) : <Dash />}
                    </TableCell>
                    <TableCell className="text-right"><Ago iso={t.updated} /></TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        ) : <Empty>No threads.</Empty>}
      </Panel>
    </>
  )
}
