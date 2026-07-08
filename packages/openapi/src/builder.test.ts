import { Controller, Get, Post } from '@enshou/core'
import { expect, it } from 'bun:test'
import { z } from 'zod'

import { OpenApiBuilder } from './builder'
import { ApiOperation } from './decorators'

const QuerySchema = z.object({
  q: z.string(),
})

const BodySchema = z.object({
  name: z.string(),
})

@Controller('/users')
class UsersController {
  @ApiOperation({
    summary: 'Get users',
    schema: { query: QuerySchema },
    responses: { 200: { description: 'Success' } },
  })
  @Get('/')
  getUsers() {}

  @ApiOperation({
    summary: 'Create user',
    schema: { json: BodySchema },
    responses: { 201: { description: 'Created' } },
  })
  @Post('/')
  createUser() {}
}

const schemaConverter = {
  toJsonSchema: (s: any) => {
    const { $schema: _, ...jsonSchema } = z.toJSONSchema(s)
    return jsonSchema
  },
}

it('should build parameters from @ApiOperation schema', () => {
  const builder = new OpenApiBuilder({
    controllers: [UsersController],
    schemaConverter,
    info: { title: 'Test API', version: '1.0.0' },
  })

  const document = builder.toDocument()

  expect(document.paths['/users']?.['get']).toBeDefined()

  const openapi = document.paths['/users']?.['get'] as any
  expect(openapi.summary).toBe('Get users')
  expect(openapi.parameters).toEqual([
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
    controllers: [UsersController],
    schemaConverter,
    info: { title: 'Test API', version: '1.0.0' },
  })

  const document = builder.toDocument()

  expect(document.paths['/users']?.['post']).toBeDefined()

  const openapi = document.paths['/users']?.['post'] as any

  expect(openapi.summary).toBe('Create user')
  expect(openapi.requestBody).toEqual({
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          required: ['name'],
          additionalProperties: false,
        },
      },
    },
  })
})
