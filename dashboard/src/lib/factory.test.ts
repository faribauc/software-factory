import { expect, test } from "bun:test"
import { checks, issueStage, runStats, threadState, type Run } from "./factory"

test("thread state", () => {
  expect(threadState("running", true, false)).toBe("needs-you")
  expect(threadState("running", false, false)).toBe("running")
  expect(threadState("completed", false, true)).toBe("done")
  expect(threadState("failed", false, false)).toBe("failed")
  expect(threadState("interrupted", false, true)).toBe("done")
  expect(threadState("completed", false, false)).toBe("ready")
  expect(threadState(undefined, false, false)).toBe("ready")
})

test("check rollup", () => {
  expect(checks({ nodes: [] })).toBe("none")
  expect(checks({ nodes: [{ commit: { statusCheckRollup: null } }] })).toBe("none")
  expect(checks({ nodes: [{ commit: { statusCheckRollup: { state: "FAILURE" } } }] })).toBe("failure")
})

test("issue stage: the first matching rule wins", () => {
  expect(issueStage(["factory:needs-human"], true, true)).toBe("done")
  expect(issueStage(["factory:needs-human", "factory"], false, true)).toBe("needs-human")
  expect(issueStage(["factory", "factory:building"], false, true)).toBe("in-review")
  expect(issueStage(["factory", "factory:building"], false, false)).toBe("building")
  expect(issueStage(["factory:needs-info"], false, false)).toBe("needs-info")
  expect(issueStage(["factory:rejected", "bug"], false, false)).toBe("rejected")
  expect(issueStage(["factory"], false, false)).toBe("accepted")
  expect(issueStage(["bug"], false, false)).toBe("new")
})

test("run stats", () => {
  const now = Date.parse("2026-11-10T12:00:00Z") / 1000
  const run = (status: string, start: string | null, end: string | null = null): Run =>
    ({ status, provider: "codex", start, end })
  const stats = runStats([
    run("completed", "2026-11-10T10:00:00Z", "2026-11-10T10:01:00Z"), // 60 s, today
    run("failed", "2026-11-08T10:00:00Z", "2026-11-08T10:03:00Z"), // 180 s
    run("completed", "2026-10-20T10:00:00Z", "2026-10-20T10:10:00Z"), // 600 s, outside 7 days and the chart
    run("running", "2026-11-10T11:59:00Z"),
    run("completed", "2026-09-01T10:00:00Z", "2026-09-01T10:01:00Z"), // outside 30 days
    run("completed", null),
  ], now)
  expect([stats.runs7, stats.runs30]).toEqual([3, 4])
  expect([stats.agent7, stats.agent30]).toEqual([240, 840])
  expect(stats.failRate30).toBe(1 / 3)
  expect(stats.median30).toBe(180)
  expect(stats.providers30).toEqual({ codex: 4 })
  expect(stats.daily).toHaveLength(14)
  expect(stats.daily.reduce((n, d) => n + d.runs, 0)).toBe(3)
  expect(stats.daily.some(d => d.runs === 0)).toBe(true)
  expect(new Set(stats.daily.map(d => d.date)).size).toBe(14)
  expect(runStats([], now)).toMatchObject({ failRate30: null, median30: null })
})
