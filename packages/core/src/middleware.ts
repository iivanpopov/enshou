import type { MiddlewareHandler } from 'hono'
import type { Env as HonoEnv } from 'hono'

import type { Token } from './container'
import type { InternalEnv } from './context'

export interface Middleware<Env extends HonoEnv = InternalEnv> {
  handle: MiddlewareHandler<Env>
}

export type MiddlewareDefinition = Token<Middleware> | MiddlewareHandler
