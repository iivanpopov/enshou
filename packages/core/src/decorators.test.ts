import type { Context, Next } from 'hono'

import { expect, it } from 'bun:test'

import { Controller, Delete, Get, Patch, Post, Put, Use } from './decorators'

function getMetadata(target: any) {
  return target[Symbol.metadata]
}

it('should register controller prefix', () => {
  @Controller('/api')
  class ApiController {}

  @Controller()
  class RootController {}

  expect(getMetadata(ApiController).prefix).toBe('/api')
  expect(getMetadata(RootController).prefix).toBe('/')
})

it('should register http method', () => {
  class TestController {
    @Get('/users') list() {}
    @Post('/users') create() {}
    @Put('/:id') replace() {}
    @Patch('/:id') patch() {}
    @Delete('/:id') remove() {}
  }

  const meta = getMetadata(TestController)

  expect(meta.routes.get('list')).toMatchObject({ method: 'GET', path: '/users' })
  expect(meta.routes.get('create')).toMatchObject({ method: 'POST', path: '/users' })
  expect(meta.routes.get('replace')).toMatchObject({ method: 'PUT', path: '/:id' })
  expect(meta.routes.get('patch')).toMatchObject({ method: 'PATCH', path: '/:id' })
  expect(meta.routes.get('remove')).toMatchObject({ method: 'DELETE', path: '/:id' })
})

it('should register middleware', () => {
  const middleware = async (c: Context, next: Next) => await next()

  @Controller()
  class TestController {
    @Use(middleware)
    @Get('/')
    index() {}
  }

  const meta = getMetadata(TestController)
  expect(meta.routes.get('index')?.middlewares.length).toBe(1)
})

it('should respect middleware order', async () => {
  const middleware1 = async (c: Context, next: Next) => await next()
  const middleware2 = async (c: Context, next: Next) => await next()

  @Controller()
  class TestController {
    @Use(middleware1, middleware2)
    @Get('/')
    index() {}
  }

  const meta = getMetadata(TestController)

  expect(meta.routes.get('index')?.middlewares.length).toBe(2)
  expect(getMetadata(TestController).routes.get('index').middlewares[0].name).toBe('middleware1')
  expect(getMetadata(TestController).routes.get('index').middlewares[1].name).toBe('middleware2')
})
