import type { Ctx } from '@enshou/core'
import type { Context } from 'hono'

import { Application, Controller, Post, RestException, Use } from '@enshou/core'
import * as v from 'valibot'
import { expect, it } from 'vitest'

import type { InferSchema } from '../src'

import { validate } from '../src'

const TestSchema = {
  json: v.object({
    name: v.string(),
    age: v.number(),
  }),
}
type TestSchema = InferSchema<typeof TestSchema>

@Controller('/test')
class TestController {
  @Post('/')
  @Use(...validate(TestSchema))
  handlePost(c: Ctx<TestSchema>) {
    const data = c.req.valid('json')
    return c.json({ data })
  }
}

const errorHandler = (err: Error, c: Context) => {
  if (err instanceof RestException) return err.toHTTP().getResponse()
  return c.text(err.message, 500)
}

it('should validate json payload and return output', async () => {
  const app = new Application({
    controllers: [TestController],
    errorHandler,
  })
  const hono = await app.instantiate()

  const res = await hono.request('/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Alice', age: 30 }),
  })

  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ data: { name: 'Alice', age: 30 } })
})

it('should throw RestException on validation failure', async () => {
  const app = new Application({
    controllers: [TestController],
    errorHandler,
  })
  const hono = await app.instantiate()

  const res = await hono.request('/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 123 }),
  })

  expect(res.status).toBe(422)
  const body = await res.json()
  expect(body.name).toBe('Unprocessable Entity')
  expect(body.code).toBe(422)
  expect(body.details.target).toBe('json')
  expect(body.details.issues).toBeDefined()
  expect(body.details.issues.length).toBeGreaterThan(0)
})
