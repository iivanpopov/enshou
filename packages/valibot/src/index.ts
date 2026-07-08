import type { MiddlewareHandler } from 'hono'
import type { ValidationTargets } from 'hono/types'

import { RestException } from '@enshou/core'
import { validator as honoValidator } from 'hono/validator'
import { safeParseAsync } from 'valibot'
import * as v from 'valibot'

export type RouteSchema = {
  [K in keyof ValidationTargets]?: v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>
}

export type InferSchema<Schema extends RouteSchema> = {
  [K in keyof Schema]: Schema[K] extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>
    ? v.InferOutput<Schema[K]>
    : never
}

export function validate(schema: RouteSchema): MiddlewareHandler[] {
  return Object.entries(schema).map(([target, schema]) => {
    return honoValidator(target as keyof ValidationTargets, async (data, _c) => {
      const result = await safeParseAsync(schema, data)

      if (result.success) return result.output

      const issues = result.issues.map((issue) => ({
        path: issue.path?.map((p) => String(p.key)),
        message: issue.message,
      }))

      throw new RestException(422, { payload: { message: 'Validation failed.', target, issues } })
    })
  })
}
