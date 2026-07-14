// import { compactObject } from '#shared/object'

// import type { JsonSchema } from './types'

// import { defineSchema, getSchemaName } from './schema'

import type { ValidationTargets } from 'hono'

// export interface SchemaAdapter<TSchema = any> {
//   toJsonSchema(schema: TSchema): JsonSchema
//   getEntries(schema: TSchema): Record<string, TSchema>
// }
import { toJsonSchema } from '@valibot/to-json-schema'
// const adapter: SchemaAdapter = {
//   toJsonSchema: (schema) => toJsonSchema(schema, { target: 'draft-2020-12' }),
//   getEntries: (schema) => schema.entries ?? {},
// }
// const PARAMETER_TARGETS = {
//   query: 'query',
//   param: 'path',
//   header: 'header',
//   cookie: 'cookie',
// } as const
// const resolveSchema = (schema: any): JsonSchema => {
//   const name = getSchemaName(schema)
//   if (!name) return adapter.toJsonSchema(schema)
//   return { $ref: `#/components/schemas/${name}` }
// }
// const buildParameters = (schema: Record<string, any>) =>
//   Object.entries(PARAMETER_TARGETS).flatMap(([target, openApiIn]) => {
//     const targetSchema = schema[target]
//     if (!targetSchema) return []
//     const required: string[] = adapter.toJsonSchema(targetSchema).required ?? []
//     const entries = adapter.getEntries(targetSchema)
//     return Object.entries(entries).map(([property, propertySchema]) => {
//       const schemaName = getSchemaName(propertySchema)
//       if (schemaName) return { $ref: `#/components/parameters/${schemaName}` }
//       return compactObject({
//         name: property,
//         in: openApiIn,
//         schema: resolveSchema(propertySchema),
//         required: required.includes(property) || openApiIn === 'path',
//       })
//     })
//   })
// //
// //
// //
// //
// //
// //
// //
// //
// //
// //
// //
// //
// //
// //
// //
// //
// //
// const PageParam = defineSchema('PageParam', v.number())
// const SearchUserSchema = defineSchema('SearchUser', {
//   query: v.object({
//     page2: PageParam,
//   }),
// })
// const SearchUserSchema2 = defineSchema('SearchUser2', {
//   query: v.object({
//     page: PageParam,
//   }),
// })
// console.log(JSON.stringify(buildParameters(SearchUserSchema), null, 2))
// console.log(JSON.stringify(buildParameters(SearchUserSchema2), null, 2))

import '#shared/polyfill'
import { parse } from 'hono/utils/cookie'
import * as v from 'valibot'

import { compactObject } from '#shared/object'

interface GenericRouteSchema extends Partial<Record<keyof ValidationTargets, any>> {}
interface GenericResponse {
  json?: any
  header?: any
  cookie?: any
}

interface ComponentMetadata {
  name?: string
  type: 'schema' | 'response'
}

function getComponentMetadata(schema: any): ComponentMetadata {
  schema[Symbol.metadata] ??= {}
  return schema[Symbol.metadata]
}

const definedSchemas: any[] = []

export function defineSchema<Schema>(name: string, schema: Schema): Schema {
  if (!schema || typeof schema !== 'object') throw Error('Schema must be an object.')

  const metadata = getComponentMetadata(schema)
  metadata.name = name
  metadata.type = 'schema'

  definedSchemas.push(schema)

  return schema
}

const definedResponses: GenericResponse[] = []

export function defineResponse<Response>(name: string, response: Response): Response {
  if (!response || typeof response !== 'object') throw Error('Schema must be an object.')

  const metadata = getComponentMetadata(response)
  metadata.name = name
  metadata.type = 'response'

  definedResponses.push(response)

  return response
}

// const EndpointResponse = defineSchema('EndpointResponse', {
//   json: IdParam,
// } satisfies GenericResponseSchema)

const resolver = {
  toJsonSchema: (schema: any) => {
    const { $schema: _, ...json } = toJsonSchema(schema, { target: 'draft-2020-12' })
    return json
  },
  getEntries: (schema: any) => schema.entries,
}

// interface BuildOperationOptions {
//   inputSchema: GenericRouteSchema
//   outputSchema: GenericResponseSchema
// }

// const PARAMETER_TARGETS = {
//   query: 'query',
//   param: 'path',
//   header: 'header',
//   cookie: 'cookie',
// }

// function buildComponentsSchemas({}) {}

// function buildOperation({ inputSchema, outputSchema }: BuildOperationOptions) {
//   console.log(JSON.stringify(Object.values(inputSchema).map(resolver.toJsonSchema), null, 2))
// }
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
// const GetUserResponse = defineResponse('GetUserResponse', {
//   headers: RateLimitHeaders,
//   json: User,
// })

// const RateLimitHeaders = defineSchema(
//   'RateLimitHeaders',
//   v.object({
//     'x-ratelimit-remaining': v.string(),
//   }),
// )

const Location = defineSchema('Location', v.string())
const Email = defineSchema('Email', v.pipe(v.string(), v.email()))

const User = defineSchema(
  'UserSchema',
  v.object({
    id: v.pipe(v.string(), v.uuid()),
    email: Email,
    name: v.string(),
  }),
)

const Headers = defineSchema(
  'Headers',
  v.object({
    location: Location,
  }),
)

const CreateUserResponse = defineResponse('CreateUserResponse', {
  header: Headers,
  json: User,
  cookie: v.object({
    'access-token': v.object({}),
  }),
} satisfies GenericResponse)

function isComponent(target: any): target is { [Symbol.metadata]: ComponentMetadata } {
  return !!target?.[Symbol.metadata]?.type
}

const paths: Record<string, any> = {}
const components: Record<string, any> = {}
const responses: Record<string, any> = {}

const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'Server API',
    verison: '1.0.0',
  },
  paths,
  components,
  responses,
}

if (isComponent(User)) console.log(User[Symbol.metadata].type)

console.log(Bun.YAML.stringify(openapi, null, 2))

//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//

//
//
//
//
//
//
//
//
//
//
