import type { Plugin, Token } from '@enshou/core'

import type { Class } from '#shared/types'

import { asCronMetadata } from './metadata'

export interface CronPluginOptions {
  jobs: Class[]
}

export function CronPlugin({ jobs }: CronPluginOptions): Plugin {
  return {
    init: async ({ container }) => {
      for (const job of jobs) {
        const provide = Symbol(job.name) as Token<any>
        container.register({ provide, useClass: job })
        const instance = await container.resolve<any>(provide)

        const metadata = asCronMetadata(job[Symbol.metadata])

        for (const [methodName, cronPattern] of metadata.jobs) {
          const handler = instance[methodName].bind(instance)
          Bun.cron(cronPattern, handler)
        }
      }
    },
  }
}
