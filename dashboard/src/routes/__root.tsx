import { HeadContent, Link, Outlet, Scripts, createRootRoute, useRouter } from "@tanstack/react-router"
import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { getState } from "@/lib/api"
import type { State } from "@/server/state"
import appCss from "../styles.css?url"

const REFRESH = 5000

type Live = { state: State; updated: Date; error: string | null }
const LiveState = createContext<Live | null>(null)

/** The latest dashboard state, polled every 5 seconds; the last good copy stays up when a refresh fails. */
export function useLive() {
  const live = useContext(LiveState)
  if (!live) throw new Error("useLive outside the root route")
  return live
}

export const Route = createRootRoute({
  ssr: false, // a local tool: the page polls server data, so server-rendered HTML adds nothing
  loader: () => getState(),
  staleTime: Infinity, // after the first load, Root's poll keeps the data fresh
  head: () => ({
    meta: [{ charSet: "utf-8" }, { name: "viewport", content: "width=device-width, initial-scale=1" }, { title: "Factory" }],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: Document,
  component: Root,
  pendingComponent: () => <Page><p className="text-sm text-muted-foreground">Loading…</p></Page>,
  errorComponent: LoadError,
  notFoundComponent: () => (
    <p className="text-sm text-muted-foreground">
      Page not found. <Link to="/" className="underline">Back to all projects</Link>
    </p>
  ),
})

function Document({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  )
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-[1320px] px-3.5 pt-4 pb-8 sm:px-6 sm:pt-5 sm:pb-10">{children}</div>
}

/** The first load failed: say why, and try again on the refresh interval. */
function LoadError({ error }: { error: unknown }) {
  const router = useRouter()
  useEffect(() => {
    const id = setInterval(() => router.invalidate(), REFRESH)
    return () => clearInterval(id)
  }, [router])
  return (
    <Page>
      <h1 className="text-xl font-semibold">Factory</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Couldn't load the dashboard: {error instanceof Error ? error.message : String(error)}. Retrying every 5 seconds.
      </p>
    </Page>
  )
}

function Root() {
  const initial = Route.useLoaderData()
  const [live, setLive] = useState<Live>({ state: initial, updated: new Date(), error: null })
  useEffect(() => {
    let busy = false // a slow `gh` call must not stack refreshes
    const id = setInterval(() => {
      if (busy) return
      busy = true
      getState().then(
        state => setLive({ state, updated: new Date(), error: null }),
        (e: Error) => setLive(l => ({ ...l, error: e.message })),
      ).finally(() => { busy = false })
    }, REFRESH)
    return () => clearInterval(id)
  }, [])
  return (
    <LiveState.Provider value={live}>
      <Page><Outlet /></Page>
    </LiveState.Provider>
  )
}
