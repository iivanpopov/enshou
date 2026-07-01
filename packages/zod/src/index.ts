import type { MiddlewareHandler } from 'hono'
import type { ValidationTargets } from 'hono/types'

import { RestException } from '@enshou/core'
import { validator as honoValidator } from 'hono/validator'
import { ZodType } from 'zod'

export type RouteSchema = {
  [K in keyof ValidationTargets]?: any
}

export type InferSchema<Schema extends RouteSchema> = {
  [K in keyof Schema]: Schema[K] extends ZodType<infer Output, any, any> ? Output : never
}

export function validate(schema: RouteSchema): MiddlewareHandler[] {
  return Object.entries(schema).map(([key, value]) => {
    return honoValidator(key as keyof ValidationTargets, async (data, _c) => {
      const zodSchema = value as ZodType<any, any, any>
      const result = await zodSchema.safeParseAsync(data)

      if (!result.success) {
        const issues = result.error.issues.map((issue) => ({
          path: issue.path?.map(String),
          message: issue.message,
        }))
        throw RestException.UnprocessableEntity({
          message: 'Validation failed.',
          target: key,
          issues,
        })
      }

      return result.data as any
    })
  })
}
