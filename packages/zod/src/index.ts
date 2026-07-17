import type { MiddlewareHandler } from 'hono'

import { ValidationException } from '@enshou/core'
import { validator as honoValidator } from 'hono/validator'
import { z } from 'zod'

export type RouteSchema = z.ZodObject<{
  json?: z.ZodTypeAny
  form?: z.ZodTypeAny
  query?: z.ZodTypeAny
  param?: z.ZodTypeAny
  header?: z.ZodTypeAny
  cookie?: z.ZodTypeAny
}>

export type ResponseSchema = z.ZodObject<{
  json?: z.ZodTypeAny
  header?: z.ZodTypeAny
  cookie?: z.ZodTypeAny
}>

export function validate(routeSchema: RouteSchema): MiddlewareHandler[] {
  return Object.entries(routeSchema.shape).map(([target, schema]) => {
    return honoValidator(target, async (data, _c) => {
      const result = await schema.safeParseAsync(data)

      if (result.success) return result.data

      const issues = result.error.issues.map((issue) => {
        return {
          message: issue.message,
          path: issue.path.map(String),
        }
      })

      throw new ValidationException(issues)
    })
  })
}
