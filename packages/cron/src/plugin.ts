import type { Plugin } from '@enshou/core'

import { createToken } from '@enshou/di'

import type { Class } from '#shared/types'

import { asCronMetadata } from './metadata'

export interface CronPluginOptions {
  jobs: Class<any>[]
}

export function CronPlugin(options: CronPluginOptions): Plugin {
  return {
    onApplicationInit: async ({ options: { container } }) => {
      for (const job of options.jobs) {
        const token = createToken<Class<any>>(job.name)
        container.registerClass(token, job)

        const instance = await container.resolveAsync(token)
        const metadata = asCronMetadata(instance[Symbol.metadata])

        for (const [methodName, cronPattern] of metadata.jobs) {
          const handler = instance[methodName].bind(instance)
          Bun.cron(cronPattern, handler)
        }
      }
    },
  }
}
