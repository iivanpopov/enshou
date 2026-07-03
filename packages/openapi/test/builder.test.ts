import { Controller, Get, Post } from '@enshou/core'
import { expect, it } from 'bun:test'

import { ApiOperation, OpenApiBuilder } from '../src'

const querySchema = {
  type: 'object',
  properties: {
    q: { type: 'string' },
  },
  required: ['q'],
}

const bodySchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
  },
  required: ['name'],
}

@Controller('/users')
class MyController {
  @ApiOperation({
    summary: 'Get users',
    schema: { query: querySchema },
    responses: { 200: { description: 'Success' } },
  })
  @Get('/')
  getUsers() {}

  @ApiOperation({
    summary: 'Create user',
    schema: { json: bodySchema },
    responses: { 201: { description: 'Created' } },
  })
  @Post('/')
  createUser() {}
}

it('should build parameters from @ApiOperation schema', () => {
  const builder = new OpenApiBuilder({
    controllers: [MyController],
    schemaConverter: { toJsonSchema: (s: any) => s },
    info: { title: 'Test API', version: '1.0.0' },
  })

  const doc = builder.toDocument()

  expect(doc.paths['/users']?.['get']).toBeDefined()
  const getOp = doc.paths['/users']?.['get'] as any
  expect(getOp.summary).toBe('Get users')
  expect(getOp.parameters).toEqual([
    {
      name: 'q',
      in: 'query',
      schema: { type: 'string' },
      required: true,
    },
  ])
})

it('should build request body from @ApiOperation schema', () => {
  const builder = new OpenApiBuilder({
    controllers: [MyController],
    schemaConverter: { toJsonSchema: (s: any) => s },
    info: { title: 'Test API', version: '1.0.0' },
  })

  const doc = builder.toDocument()

  expect(doc.paths['/users']?.['post']).toBeDefined()
  const postOp = doc.paths['/users']?.['post'] as any
  expect(postOp.summary).toBe('Create user')
  expect(postOp.requestBody).toEqual({
    required: true,
    content: {
      'application/json': {
        schema: bodySchema,
      },
    },
  })
})
