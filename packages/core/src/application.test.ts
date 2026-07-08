import type { Context } from 'hono'

import { Inject, createToken } from '@enshou/di'
import { expect, it, mock } from 'bun:test'

import { Application } from './application'
import { Controller, Delete, Get, Post, Put } from './decorators'

it('should return a Hono instance', async () => {
  const app = await new Application({}).instantiate()
  expect(typeof app.fetch).toBe('function')
})

it('should mount controller routes', async () => {
  @Controller('/hello')
  class HelloController {
    @Get('/')
    greet(c: Context) {
      return c.json({ message: 'hi' })
    }
  }

  const hono = await new Application({ controllers: [HelloController] }).instantiate()
  const res = await hono.request('/hello')
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ message: 'hi' })
})

it('should handle controller with no routes', async () => {
  @Controller('/empty')
  class EmptyController {}

  const hono = await new Application({ controllers: [EmptyController] }).instantiate()
  const res = await hono.request('/empty')
  expect(res.status).toBe(404)
})

it('should combine controller prefix + route path', async () => {
  @Controller('/api/v1')
  class ApiController {
    @Get('/status')
    status(c: Context) {
      return c.json({ ok: true })
    }
  }

  const hono = await new Application({ controllers: [ApiController] }).instantiate()
  const res = await hono.request('/api/v1/status')
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ ok: true })
})

it('should support multiple HTTP methods on same controller', async () => {
  @Controller('/items')
  class ItemsController {
    @Get('/')
    list(c: Context) {
      return c.json([])
    }

    @Post('/')
    create(c: Context) {
      return c.json({ id: 1 }, 201)
    }

    @Put('/:id')
    replace(c: Context) {
      return c.json({ id: c.req.param('id') })
    }

    @Delete('/:id')
    remove(c: Context) {
      return c.body(null, 204)
    }
  }

  const hono = await new Application({ controllers: [ItemsController] }).instantiate()

  expect((await hono.request('/items')).status).toBe(200)
  expect((await hono.request('/items', { method: 'POST' })).status).toBe(201)
  expect((await hono.request('/items/42', { method: 'PUT' })).status).toBe(200)
  expect((await hono.request('/items/42', { method: 'DELETE' })).status).toBe(204)
})

it('should mount multiple controllers', async () => {
  @Controller('/a')
  class AController {
    @Get('/')
    get(c: Context) {
      return c.json({ from: 'a' })
    }
  }

  @Controller('/b')
  class BController {
    @Get('/')
    get(c: Context) {
      return c.json({ from: 'b' })
    }
  }

  const hono = await new Application({ controllers: [AController, BController] }).instantiate()
  expect(await (await hono.request('/a')).json()).toEqual({ from: 'a' })
  expect(await (await hono.request('/b')).json()).toEqual({ from: 'b' })
})

it('should use custom error handler', async () => {
  @Controller('/err')
  class ErrController {
    @Get('/')
    boom() {
      throw new Error('boom')
    }
  }

  const handler = mock<(_err: Error, c: Context) => Response | Promise<Response>>((_err, c) =>
    c.json({ caught: true }, 500),
  )

  const hono = await new Application({
    controllers: [ErrController],
    errorHandler: handler,
  }).instantiate()

  const res = await hono.request('/err')
  expect(res.status).toBe(500)
  expect(handler).toHaveBeenCalledTimes(1)
})

it('should resolve provider classes and inject into controller', async () => {
  const GREETER_TOKEN = createToken<Greeter>('greeter')

  class Greeter {
    greet() {
      return 'hello from service'
    }
  }

  @Controller('/svc')
  @Inject(GREETER_TOKEN)
  class SvcController {
    constructor(private readonly greeter: Greeter) {}

    @Get('/')
    get(c: Context) {
      return c.json({ msg: this.greeter.greet() })
    }
  }

  const hono = await new Application({
    controllers: [SvcController],
    providers: [{ provide: GREETER_TOKEN, useClass: Greeter }],
  }).instantiate()

  const res = await hono.request('/svc')
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ msg: 'hello from service' })
})
