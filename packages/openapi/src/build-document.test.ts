import type { Module } from '@enshou/core'
import type { ResponseSchema, RouteSchema } from '@enshou/valibot'

import { Controller, Get } from '@enshou/core'
import { describe, it, expect } from 'bun:test'
import * as v from 'valibot'

import { valibotAdapter } from './adapters'
import { buildDocument } from './build-document'
import { defineSchema, defineResponse } from './components'
import { ApiOperation, ApiResponse, ApiTag } from './decorators'

describe('buildDocument', () => {
  it('should generate valid OpenAPI document structure', () => {
    const User = defineSchema(
      'User',
      v.object({
        id: v.number(),
        name: v.string(),
      }),
    )

    const GetUsersQuery = defineSchema(
      'GetUsersQueryDto',
      v.object({
        search: v.optional(v.string()),
      }),
    )

    const GetUsersRoute = v.object({
      query: GetUsersQuery,
    }) satisfies RouteSchema

    const GetUsersResponseBody = defineSchema(
      'GetUsersResponseBody',
      v.object({
        users: v.array(User),
      }),
    )

    const GetUsersResponse = defineResponse(
      'GetUsersResponse',
      v.object({
        json: GetUsersResponseBody,
      }),
    ) satisfies ResponseSchema

    const BadRequestResponseBody = defineSchema(
      'BadRequestResponseBody',
      v.object({
        code: v.number(),
        error: v.string(),
      }),
    )

    const BadRequestResponse = defineResponse(
      'BadRequestResponse',
      v.object({
        header: v.object({
          'X-Error-Trace': v.string(),
        }),
        json: BadRequestResponseBody,
      }),
    ) satisfies ResponseSchema

    @ApiTag('Users')
    @Controller('/users')
    class UserController {
      @ApiResponse(200, {
        $ref: GetUsersResponse,
        description: 'Retrieve all users',
      })
      @ApiResponse(400, { $ref: BadRequestResponse })
      @ApiOperation({
        schema: GetUsersRoute,
        summary: 'Get users',
      })
      @Get('/')
      getUsers() {}
    }

    const UserModule = {
      controllers: [UserController],
      name: 'UserModule',
    } satisfies Module

    const document = buildDocument({
      adapter: valibotAdapter,
      modules: [UserModule],
      openapi: {
        info: {
          title: 'Application',
          version: '1.0.0',
        },
      },
    })

    expect(document.openapi).toBe('3.1.0')
    expect(document.paths['/users']?.get?.responses['200']).toBeDefined()

    const response200 = document.components.responses.GetUsersResponse as any
    expect(response200.content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/GetUsersResponseBody',
    })

    expect(document.paths['/users'].get.responses['400']).toEqual({
      $ref: '#/components/responses/BadRequestResponse',
    })

    expect(document.components.responses.BadRequestResponse).toBeDefined()
    expect(document.components.responses.User).toBeUndefined()
    expect(document.components.responses.GetUsersQueryDto).toBeUndefined()

    expect(document.components.schemas.User).toBeDefined()
    expect(document.components.schemas.GetUsersQueryDto).toBeDefined()
    expect(document.components.schemas.GetUsersResponseBody).toBeDefined()
    expect(document.components.schemas.BadRequestResponseBody).toBeDefined()
    expect(document.components.schemas.BadRequestResponse).toBeUndefined()

    expect(
      (document.components.responses.BadRequestResponse as any).content['application/json'].schema,
    ).toEqual({
      $ref: '#/components/schemas/BadRequestResponseBody',
    })
  })
})
