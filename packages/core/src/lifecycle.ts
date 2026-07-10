import type { Hono } from 'hono'

import type { Application, ApplicationOptions } from './application'

export interface OnApplicationInit {
  onApplicationInit({
    hono,
    options,
    application,
  }: {
    hono: Hono
    options: ApplicationOptions
    application: Application
  }): Promise<void> | void
}
