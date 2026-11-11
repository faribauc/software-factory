export const ago = (iso: string) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000)
  return m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`
}
export const dur = (s: number | null) =>
  s == null ? "–" : s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}m` : `${(s / 3600).toFixed(1)}h`
export const pct = (r: number | null) => (r == null ? "–" : `${Math.round(r * 100)}%`)
export const within = (iso: string | undefined, days: number) => Boolean(iso) && Date.now() - Date.parse(iso!) < days * 864e5
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`
/** A YYYY-MM-DD local date, at midday so no time zone moves it to another day. */
export const day = (date: string) => new Date(`${date}T12:00:00`)
export const shortDate = (date: string) => day(date).toLocaleDateString(undefined, { month: "short", day: "numeric" })
