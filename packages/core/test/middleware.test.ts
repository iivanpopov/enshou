import type { Context, Next } from 'hono'

import { createToken, Inject } from '@enshou/di'
import { expect, it, mock } from 'bun:test'

import type { Middleware } from '../src/middleware'

import { Application } from '../src/application'
import { Controller, Get, Use } from '../src/decorators'

it('should apply injectable middleware', async () => {
  const TEST_MIDDLEWARE_TOKEN = createToken<TestMiddleware>('test-middleware')
  const middlewareSpy = mock<() => void>()

  class TestMiddleware implements Middleware {
    async handle(c: Context, next: Next) {
      middlewareSpy()
      await next()
    }
  }

  @Controller()
  class TestController {
    @Use(TEST_MIDDLEWARE_TOKEN)
    @Get('/')
    index(c: Context) {
      return c.text('hello')
    }
  }

  const app = await new Application({
    controllers: [TestController],
    providers: [{ provide: TEST_MIDDLEWARE_TOKEN, useClass: TestMiddleware }],
  }).instantiate()

  const res = await app.request('/')
  expect(res.status).toBe(200)
  expect(await res.text()).toBe('hello')
  expect(middlewareSpy).toHaveBeenCalled()
})

it('should apply controller-wide middleware', async () => {
  const GLOBAL_MIDDLEWARE_TOKEN = createToken<GlobalMiddleware>('global-middleware')
  const middlewareSpy = mock<() => void>()

  class GlobalMiddleware implements Middleware {
    async handle(c: Context, next: Next) {
      middlewareSpy()
      await next()
    }
  }

  @Use(GLOBAL_MIDDLEWARE_TOKEN)
  @Controller()
  class TestController {
    @Get('/')
    index(c: Context) {
      return c.text('hello')
    }
  }

  const app = await new Application({
    controllers: [TestController],
    providers: [{ provide: GLOBAL_MIDDLEWARE_TOKEN, useClass: GlobalMiddleware }],
  }).instantiate()

  const res = await app.request('/')
  expect(res.status).toBe(200)
  expect(middlewareSpy).toHaveBeenCalled()
})

it('should resolve dependencies in middleware', async () => {
  const SERVICE_TOKEN = createToken<Service>('service')
  const DI_MIDDLEWARE_TOKEN = createToken<DIMiddleware>('di-middleware')

  class Service {
    getName() {
      return 'di'
    }
  }

  @Inject(SERVICE_TOKEN)
  class DIMiddleware implements Middleware {
    constructor(private service: Service) {}

    async handle(c: Context, next: Next) {
      c.header('x-service', this.service.getName())
      await next()
    }
  }

  @Controller()
  class TestController {
    @Use(DI_MIDDLEWARE_TOKEN)
    @Get('/')
    index(c: Context) {
      return c.text('hello')
    }
  }

  const app = await new Application({
    controllers: [TestController],
    providers: [
      { provide: SERVICE_TOKEN, useClass: Service },
      { provide: DI_MIDDLEWARE_TOKEN, useClass: DIMiddleware },
    ],
  }).instantiate()

  const res = await app.request('/')
  expect(res.headers.get('x-service')).toBe('di')
})

it('should support multiple middlewares and maintain order', async () => {
  const order: string[] = []
  const M1_TOKEN = createToken<M1>('m1')
  const M2_TOKEN = createToken<M2>('m2')

  class M1 implements Middleware {
    async handle(_c: Context, next: Next) {
      order.push('m1')
      await next()
    }
  }

  class M2 implements Middleware {
    async handle(_c: Context, next: Next) {
      order.push('m2')
      await next()
    }
  }

  @Use(M1_TOKEN)
  @Controller()
  class TestController {
    @Use(M2_TOKEN)
    @Get('/')
    index(c: Context) {
      return c.text('hello')
    }
  }

  const app = await new Application({
    controllers: [TestController],
    providers: [
      { provide: M1_TOKEN, useClass: M1 },
      { provide: M2_TOKEN, useClass: M2 },
    ],
  }).instantiate()

  await app.request('/')
  expect(order).toEqual(['m1', 'm2'])
})

it('should support raw hono middleware', async () => {
  const rawMiddleware = async (c: Context, next: Next) => {
    c.header('x-raw', 'true')
    await next()
  }

  @Controller()
  class TestController {
    @Use(rawMiddleware)
    @Get('/')
    index(c: Context) {
      return c.text('hello')
    }
  }

  const app = await new Application({
    controllers: [TestController],
  }).instantiate()

  const res = await app.request('/')
  expect(res.headers.get('x-raw')).toBe('true')
})
