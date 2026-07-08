import type { Context, Env as HonoEnv } from 'hono'
import type { BlankEnv } from 'hono/types'

export interface GlobalEnv {}

export type InternalEnv = keyof GlobalEnv extends never ? BlankEnv : GlobalEnv

export type Ctx<Out = {}, Env extends HonoEnv = never> = Context<
  Env extends never ? InternalEnv : Env,
  any,
  { out: Out & {} }
>
