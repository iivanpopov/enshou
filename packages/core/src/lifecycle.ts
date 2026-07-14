import type { Hono } from 'hono'

import type { ResolvedApplicationOptions } from './application'

export interface OnInitContext {
  hono: Hono
  options: ResolvedApplicationOptions
}

export interface OnInit {
  onInit(ctx: OnInitContext): Promise<void> | void
}
