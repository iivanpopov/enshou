import type { MiddlewareHandler } from 'hono'
import type { ValidationTargets } from 'hono/types'

import { RestException } from '@enshou/core'
import { validator as honoValidator } from 'hono/validator'
import { ZodType } from 'zod'

export type RouteSchema = Record<keyof ValidationTargets, ZodType>

export type InferSchema<Schema extends RouteSchema> = {
  [K in keyof Schema]: Schema[K] extends ZodType<infer Output, any, any> ? Output : never
}

export function validate(schema: RouteSchema): MiddlewareHandler[] {
  return Object.entries(schema).map(([target, schema]) => {
    return honoValidator(target as keyof ValidationTargets, async (data, _c) => {
      const result = await schema.safeParseAsync(data)

      if (result.success) return result.data

      const issues = result.error.issues.map((issue) => ({
        path: issue.path?.map(String),
        message: issue.message,
      }))

      throw new RestException(422, { payload: { message: 'Validation failed.', target, issues } })
    })
  })
}
