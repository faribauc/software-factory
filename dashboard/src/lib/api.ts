import { createServerFn } from "@tanstack/react-start"
import { buildState } from "@/server/state"

export const getState = createServerFn({ method: "GET" }).handler(() => buildState())
