// Pure rules for the factory flow: shared by the server and the page, tested in factory.test.ts.

export type ThreadState = "needs-you" | "failed" | "running" | "ready" | "done"
export type Stage =
  | "new" | "needs-info" | "rejected" | "accepted" | "building" | "in-review" | "needs-human" | "done"
export type Checks = "success" | "failure" | "error" | "pending" | "expected" | "none"

export type Run = { status: string; provider: string; start: string | null; end: string | null }
export type Stats = {
  runs7: number
  runs30: number
  agent7: number
  agent30: number
  failRate30: number | null
  median30: number | null
  providers30: Record<string, number>
  daily: { date: string; runs: number }[]
}

export function threadState(run: string | undefined, waiting: boolean, settled: boolean): ThreadState {
  if (waiting) return "needs-you"
  if (run === "running") return "running"
  if (settled) return "done"
  if (run === "failed" || run === "interrupted") return "failed"
  return "ready" // finished, not yet settled: waiting for you to look
}

/** Where an issue is in the factory flow; the first rule that matches wins. */
export function issueStage(labels: string[], closed: boolean, openPr: boolean): Stage {
  if (closed) return "done"
  if (labels.includes("factory:needs-human")) return "needs-human"
  if (openPr) return "in-review"
  const byLabel: [string, Stage][] = [
    ["factory:building", "building"],
    ["factory:needs-info", "needs-info"],
    ["factory:rejected", "rejected"],
    ["factory", "accepted"],
  ]
  return byLabel.find(([label]) => labels.includes(label))?.[1] ?? "new"
}

type Commits = { nodes: { commit: { statusCheckRollup: { state: string } | null } }[] }
export function checks(commits: Commits): Checks {
  const rollup = commits.nodes[0]?.commit.statusCheckRollup
  return rollup ? (rollup.state.toLowerCase() as Checks) : "none"
}

const DAY = 86400
const seconds = (iso: string) => Date.parse(iso) / 1000
const localDate = (t: number) => {
  const d = new Date(t * 1000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Agent activity from T3 runs: last 7 and 30 days, and runs per day for 14 days. `now` is in seconds. */
export function runStats(runs: Run[], now: number): Stats {
  const timed = runs.flatMap(r => (r.start ? [{ r, start: seconds(r.start), end: r.end ? seconds(r.end) : null }] : []))
  const window = (days: number) => timed.filter(x => now - x.start < days * DAY)
  const week = window(7), month = window(30)
  const finished = month.filter(x => x.r.status !== "running")
  const durations = finished.flatMap(x => (x.end ? [x.end - x.start] : []))
  const agent = (xs: typeof timed) => Math.round(xs.reduce((n, x) => n + (x.end ? x.end - x.start : 0), 0))
  const providers: Record<string, number> = {}
  for (const x of month) providers[x.r.provider] = (providers[x.r.provider] ?? 0) + 1
  const perDay: Record<string, number> = {}
  for (const x of timed) perDay[localDate(x.start)] = (perDay[localDate(x.start)] ?? 0) + 1
  const noon = new Date(now * 1000)
  noon.setHours(12, 0, 0, 0) // step back whole days from midday so DST shifts can't skip a date
  return {
    runs7: week.length,
    runs30: month.length,
    agent7: agent(week),
    agent30: agent(month),
    failRate30: finished.length
      ? finished.filter(x => x.r.status === "failed" || x.r.status === "interrupted").length / finished.length
      : null,
    median30: durations.length ? Math.round(median(durations)) : null,
    providers30: Object.fromEntries(Object.entries(providers).sort((a, b) => b[1] - a[1])),
    daily: Array.from({ length: 14 }, (_, i) => {
      const date = localDate(noon.getTime() / 1000 - (13 - i) * DAY)
      return { date, runs: perDay[date] ?? 0 }
    }),
  }
}
