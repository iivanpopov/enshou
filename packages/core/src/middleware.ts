import type { Token } from '@enshou/di'
import type { MiddlewareHandler } from 'hono'
import type { Env as HonoEnv } from 'hono'

import type { InternalEnv } from './context'

export interface Middleware<Env extends HonoEnv = InternalEnv> {
  handle: MiddlewareHandler<Env>
}

export type MiddlewareDefinition = Token<Middleware> | MiddlewareHandler
