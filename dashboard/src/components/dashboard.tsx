// Building blocks shared by the overview and the project view.
import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { cn } from "cn"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Checks, Stage, Stats, ThreadState } from "@/lib/factory"
import { ago, day, plural, shortDate } from "@/lib/format"
import { useLive } from "@/routes/__root"
import type { GitHub, Issue, IssuePr, Project } from "@/server/state"

// Every state is a dot plus its label: colour is never the only cue.
// Tone classes are spelled out in full so Tailwind sees them.
export const THREAD: Record<ThreadState, [string, string]> = {
  "needs-you": ["needs you", "bg-critical"],
  failed: ["failed", "bg-serious"],
  running: ["running", "bg-series"],
  ready: ["ready", "bg-warning"],
  done: ["done", "bg-good"],
}
export const THREAD_ORDER = Object.keys(THREAD) as ThreadState[]
export const STAGES: [Stage, string, string][] = [
  ["new", "New", "bg-s-new"],
  ["needs-info", "Needs info", "bg-s-needs-info"],
  ["rejected", "Rejected", "bg-s-rejected"],
  ["accepted", "Accepted", "bg-s-accepted"],
  ["building", "Building", "bg-s-building"],
  ["in-review", "In review", "bg-s-in-review"],
  ["needs-human", "Needs human", "bg-s-needs-human"],
  ["done", "Done", "bg-s-done"],
]
export const stageInfo = (k: Stage) => STAGES.find(s => s[0] === k)!
const CHECKS: Record<Checks, [string, string]> = {
  success: ["passing", "bg-good"],
  failure: ["failing", "bg-critical"],
  error: ["failing", "bg-critical"],
  pending: ["pending", "bg-warning"],
  expected: ["pending", "bg-warning"],
  none: ["no checks", "bg-axis"],
}
const PROVIDERS = ["claudeAgent", "codex", "opencode"] // fixed order: a provider keeps its colour
export const FLOW_LABELS = new Set(["factory", "factory:needs-info", "factory:rejected", "factory:building", "factory:needs-human"])

export const gh = (p: Project) => (p.github && "issues" in p.github ? p.github : null)
export const ghError = (g: GitHub | null) => (g && "error" in g ? g.error : null)
export const issuesOf = (p: Project) => gh(p)?.issues ?? []
export const prsOf = (p: Project) => gh(p)?.prs ?? []
export const mergedOf = (p: Project) => gh(p)?.merged ?? []
export const failing = (pr: { checks: Checks }) => pr.checks === "failure" || pr.checks === "error"

export function Status({ label, tone, className }: { label?: string; tone: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground", className)}>
      <i className={cn("size-2 flex-none rounded-full", tone)} />
      {label}
    </span>
  )
}
export const ThreadStatus = ({ state }: { state: ThreadState }) => <Status label={THREAD[state][0]} tone={THREAD[state][1]} />
export const CheckStatus = ({ pr }: { pr: IssuePr }) =>
  pr.isDraft ? <Status label="draft" tone="bg-axis" /> : <Status label={CHECKS[pr.checks][0]} tone={CHECKS[pr.checks][1]} />

export function PrFlags({ pr }: { pr: IssuePr }) {
  return (
    <>
      {pr.reviewDecision === "CHANGES_REQUESTED" && <Status label="changes requested" tone="bg-critical" />}
      {pr.reviewDecision === "APPROVED" && <Status label="approved" tone="bg-good" />}
      {pr.mergeable === "CONFLICTING" && <Status label="conflict" tone="bg-critical" />}
    </>
  )
}
export const hasFlags = (pr: IssuePr) =>
  pr.reviewDecision === "CHANGES_REQUESTED" || pr.reviewDecision === "APPROVED" || pr.mergeable === "CONFLICTING"

export const Meta = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span className={cn("text-xs text-muted-foreground", className)}>{children}</span>
)
export const Dash = () => <Meta>–</Meta>

/** The page header: a title or breadcrumb, side notes, and when the data was last refreshed. */
export function Header({ children }: { children: ReactNode }) {
  const { updated, error } = useLive()
  return (
    <header className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      {children}
      <Meta className="ml-auto">
        {error ? <Status label={`refresh failed: ${error}`} tone="bg-critical" className="whitespace-normal" /> : `updated ${updated.toLocaleTimeString()}`}
      </Meta>
    </header>
  )
}

export function Panel({ title, meta, children, className }: { title: string; meta?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={cn("min-w-0 gap-3", className)}>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {meta != null && <CardAction><Meta>{meta}</Meta></CardAction>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function Stat({ label, value, sub, children, hero, className }: {
  label: string; value: ReactNode; sub?: ReactNode; children?: ReactNode; hero?: boolean; className?: string
}) {
  return (
    <Card size="sm" className={cn("min-w-0 gap-0.5 px-4 py-3.5", className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <b className={cn("font-semibold tabular-nums", hero ? "text-5xl leading-none my-1" : "text-2xl leading-tight")}>{value}</b>
      {sub != null && <span className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">{sub}</span>}
      {children}
    </Card>
  )
}

/** 14 days of runs as mini columns; the last 7 (the stat's period) in the series colour. */
export function Spark({ daily, w = 112, h = 26 }: { daily: Stats["daily"]; w?: number; h?: number }) {
  const max = Math.max(1, ...daily.map(d => d.runs)), bw = w / daily.length
  return (
    <svg className="mt-1.5 block" width={w} height={h} aria-hidden="true">
      {daily.map((d, i) => {
        const bh = d.runs ? Math.max(2, (d.runs / max) * h) : 1
        const fill = !d.runs ? "fill-grid-line" : i >= daily.length - 7 ? "fill-series" : "fill-series-prev"
        return <rect key={d.date} className={fill} x={i * bw + 1} y={h - bh} width={bw - 2} height={bh} rx={1} />
      })}
    </svg>
  )
}

/** Runs per day as columns, with a gridline at half and a table view for exact numbers. */
export function RunsChart({ daily }: { daily: Stats["daily"] }) {
  const peak = Math.max(...daily.map(d => d.runs))
  const e = 10 ** Math.floor(Math.log10(Math.max(peak, 1)))
  const top = [2, 4, 6, 8, 10].map(f => f * e).find(x => x >= peak)! // gridline at half stays a whole number
  const total = daily.reduce((n, d) => n + d.runs, 0)
  return (
    <>
      <div className="relative mt-1 mb-5 ml-7 flex h-[150px] items-end border-b border-axis" role="img"
        aria-label={`${total} runs in 14 days, peak ${peak} in a day`}>
        {[0, 0.5, 1].map(f => (
          <div key={f} className={cn("absolute inset-x-0", f > 0 && "border-t border-grid-line")} style={{ bottom: `${f * 100}%` }}>
            <span className="absolute right-full -translate-x-1.5 -translate-y-1/2 text-[11px] text-muted-foreground tabular-nums">{top * f}</span>
          </div>
        ))}
        {daily.map((d, i) => (
          <div key={d.date} title={`${shortDate(d.date)}: ${plural(d.runs, "run")}`}
            className="relative flex h-full flex-1 items-end justify-center hover:bg-muted/60">
            {d.runs > 0 && (
              <div className="relative w-[min(24px,70%)] rounded-t bg-series" style={{ height: `${(d.runs / top) * 100}%` }}>
                {d.runs === peak && <span className="absolute bottom-full left-1/2 -translate-x-1/2 pb-0.5 text-[11px] text-muted-foreground">{d.runs}</span>}
              </div>
            )}
            {i % 2 !== daily.length % 2 && (
              <span className="absolute top-full pt-1 text-[11px] text-muted-foreground tabular-nums">{day(d.date).getDate()}</span>
            )}
          </div>
        ))}
      </div>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">Table</summary>
        <table className="mt-2 w-full">
          <thead><tr><th className="text-left font-medium">Day</th><th className="text-right font-medium">Runs</th></tr></thead>
          <tbody>
            {daily.map(d => (
              <tr key={d.date}><td>{shortDate(d.date)}</td><td className="text-right tabular-nums">{d.runs}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  )
}

export function ProviderSplit({ counts }: { counts: Record<string, number> }) {
  const parts = Object.entries(counts).sort((a, b) => b[1] - a[1])
  const total = parts.reduce((n, [, c]) => n + c, 0)
  if (!total) return <Empty>No runs in 30 days.</Empty>
  const colour = (name: string) => {
    const i = PROVIDERS.indexOf(name)
    return `var(--c${i < 0 ? 4 : i + 1})`
  }
  return (
    <>
      <div className="flex h-7 gap-0.5" role="img" aria-label={parts.map(([n, c]) => `${n} ${c}`).join(", ")}>
        {parts.map(([n, c]) => {
          const share = Math.round((c / total) * 100)
          return (
            <div key={n} className="flex min-w-0.5 items-center rounded px-2 text-xs font-semibold whitespace-nowrap text-white"
              style={{ flex: `${c} 1 0`, background: colour(n) }} title={`${n}: ${plural(c, "run")} (${share}%)`}>
              {share >= 12 && `${share}%`}
            </div>
          )
        })}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
        {parts.map(([n, c]) => (
          <li key={n} className="inline-flex items-center gap-1.5">
            <i className="size-2.5 rounded-sm" style={{ background: colour(n) }} />{n} · {c}
          </li>
        ))}
      </ul>
    </>
  )
}

/** Every stage in flow order with its count. */
export function Flow({ issues }: { issues: Issue[] }) {
  return (
    <div className="grid grid-cols-4 gap-0.5 overflow-hidden rounded-lg lg:grid-cols-8">
      {STAGES.map(([k, name, tone]) => {
        const c = issues.filter(i => i.stage === k).length
        return (
          <div key={k} className="flex min-w-0 flex-col gap-1 bg-background px-3 py-2.5">
            <Status label={name} tone={tone} className="whitespace-normal" />
            <b className={cn("text-2xl tabular-nums", c ? "font-semibold" : "font-normal text-muted-foreground")}>{c}</b>
          </div>
        )
      })}
    </div>
  )
}

export const Empty = ({ children }: { children: ReactNode }) => <p className="py-2 text-sm text-muted-foreground">{children}</p>

export const ProjectLink = ({ p, children, className }: { p: Project; children: ReactNode; className?: string }) => (
  <Link to="/p/$projectId" params={{ projectId: p.id }} className={className}>{children}</Link>
)

export const Ago = ({ iso, prefix }: { iso: string; prefix?: string }) => <Meta>{prefix}{ago(iso)}{prefix ? " ago" : ""}</Meta>
