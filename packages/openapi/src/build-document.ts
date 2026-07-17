import type { Module } from '@enshou/core'
import type { ValidationTargets } from 'hono'

import { asControllerMetadata } from '@enshou/core'

import { normalizePath } from '#/shared/utils'

import type { ComponentsRegistry } from './components'
import type { OperationMeta, ResponseDefinition, ResponseRef, InlineResponse } from './metadata'

import { parseResponseSchema } from './adapters/utils'
import { defaultRegistry } from './components'
import { asOpenApiMetadata } from './metadata'

export interface OpenApiAdapter {
  buildSchemas(schemasMap: Map<unknown, string>): Record<string, unknown>
  buildResponses(
    responsesMap: Map<unknown, string>,
    schemasMap: Map<unknown, string>,
  ): Record<string, unknown>
  toJsonSchema(schema: unknown): unknown
  getPropertySchema(schema: unknown, key: string): unknown
}

export interface OpenApiOptions {
  info: {
    title: string
    version: string
  }
}

export interface BuildDocumentOptions {
  adapter: OpenApiAdapter
  openapi: OpenApiOptions
  modules: Module[]
  registry?: ComponentsRegistry
}

export interface OpenApiDocument {
  openapi: '3.1.0'
  info: {
    title: string
    version: string
  }
  paths: Record<string, Record<string, OpenApiOperation>>
  components: {
    schemas: Record<string, unknown>
    responses: Record<string, unknown>
  }
}

export interface JsonSchema {
  properties?: Record<string, JsonSchema>
  required?: string[]
  [key: string]: unknown
}

interface OpenApiParameter {
  in: 'query' | 'path' | 'header' | 'cookie'
  name: string
  required: boolean
  schema: unknown
}

interface OpenApiOperation {
  tags?: string[]
  summary?: string
  parameters?: OpenApiParameter[]
  requestBody?: { content: Record<string, { schema: unknown }> }
  responses: Record<string, unknown>
}

const PARAM_LOCATIONS = [
  { in: 'query', key: 'query' },
  { in: 'path', key: 'param' },
  { in: 'header', key: 'header' },
  { in: 'cookie', key: 'cookie' },
] as const satisfies { in: string; key: keyof ValidationTargets }[]

function buildParameters(jsonSchema: JsonSchema): OpenApiParameter[] {
  const properties = jsonSchema.properties ?? {}

  return PARAM_LOCATIONS.flatMap(({ key, in: location }) => {
    const schema = properties[key]
    if (!schema?.properties) return []

    return Object.entries(schema.properties).map(([propertyName, propertySchema]) => {
      return {
        in: location,
        name: propertyName,
        required: schema.required?.includes(propertyName) ?? false,
        schema: propertySchema,
      }
    })
  })
}

function buildRequestBody(
  adapter: OpenApiAdapter,
  operationSchema: unknown,
  jsonSchema: JsonSchema,
  schemasMap: Map<unknown, string>,
): OpenApiOperation['requestBody'] | undefined {
  const jsonBodySchema = adapter.getPropertySchema(operationSchema, 'json')
  const formBodySchema = adapter.getPropertySchema(operationSchema, 'form')
  const bodySchema = jsonBodySchema ?? formBodySchema

  const schemaName = schemasMap.get(bodySchema)
  if (bodySchema && schemaName) {
    const contentType = jsonBodySchema ? 'application/json' : 'application/x-www-form-urlencoded'
    return {
      content: {
        [contentType]: {
          schema: { $ref: `#/components/schemas/${schemaName}` },
        },
      },
    }
  }

  const properties = jsonSchema.properties ?? {}
  if (!properties.json && !properties.form) return undefined

  const content: Record<string, { schema: unknown }> = {}
  if (properties.json) content['application/json'] = { schema: properties.json }
  if (properties.form) content['application/x-www-form-urlencoded'] = { schema: properties.form }

  return { content }
}

function resolveRefResponse(
  response: ResponseRef,
  responsesMap: Map<unknown, string>,
): Record<string, unknown> | undefined {
  const schemaName = responsesMap.get(response.$ref)
  if (!schemaName) return undefined

  return {
    $ref: `#/components/responses/${schemaName}`,
    description: response.description,
  }
}

function buildInlineResponse(
  adapter: OpenApiAdapter,
  response: InlineResponse,
): Record<string, unknown> {
  const { schema, ...rest } = response

  if (!schema) return rest

  const jsonSchema = adapter.toJsonSchema(schema)
  const parsedResponse = parseResponseSchema(jsonSchema)

  return {
    ...rest,
    ...parsedResponse,
  }
}

function buildOperationResponses(
  adapter: OpenApiAdapter,
  responsesRecord: Record<string, ResponseDefinition>,
  responsesMap: Map<unknown, string>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [status, response] of Object.entries(responsesRecord)) {
    if (response && '$ref' in response && response.$ref) {
      const resolved = resolveRefResponse(response, responsesMap)
      if (resolved) result[status] = resolved
    } else if (response) {
      result[status] = buildInlineResponse(adapter, response)
    }
  }

  return result
}

function buildOperation(
  adapter: OpenApiAdapter,
  controllerTags: string[],
  operationMetadata: OperationMeta = {},
  schemasMap: Map<unknown, string>,
  responsesMap: Map<unknown, string>,
): OpenApiOperation {
  const tags = operationMetadata?.tags
    ? [...controllerTags, ...operationMetadata.tags]
    : controllerTags

  const operation: OpenApiOperation = {
    responses: {},
    summary: operationMetadata.summary,
    tags,
  }

  if (operationMetadata?.schema) {
    const jsonSchema = adapter.toJsonSchema(operationMetadata.schema) as JsonSchema

    operation.parameters = buildParameters(jsonSchema)
    operation.requestBody = buildRequestBody(
      adapter,
      operationMetadata.schema,
      jsonSchema,
      schemasMap,
    )
  }

  if (operationMetadata?.responses) {
    operation.responses = buildOperationResponses(
      adapter,
      operationMetadata.responses,
      responsesMap,
    )
  }

  return operation
}

export function buildDocument({
  adapter,
  openapi,
  modules,
  registry = defaultRegistry,
}: BuildDocumentOptions): OpenApiDocument {
  const paths: Record<string, Record<string, OpenApiOperation>> = {}

  for (const module of modules) {
    for (const Controller of module.controllers) {
      const controllerMetadata = asControllerMetadata(Controller[Symbol.metadata])
      const controllerOpenApiMetadata = asOpenApiMetadata(controllerMetadata).openapi

      for (const [handlerName, route] of Object.entries(controllerMetadata.routes)) {
        const fullPath = normalizePath(`${controllerMetadata.prefix}/${route.path}`)
        const openApiPath = fullPath.replaceAll(/:([a-zA-Z0-9_]+)/g, '{$1}')

        const operationMetadata = controllerOpenApiMetadata.operations?.[handlerName]
        const operation = buildOperation(
          adapter,
          controllerOpenApiMetadata.tags,
          operationMetadata,
          registry.schemas,
          registry.responses,
        )

        paths[openApiPath] ??= {}
        paths[openApiPath][route.method.toLowerCase()] = operation
      }
    }
  }

  return {
    components: {
      responses: adapter.buildResponses(registry.responses, registry.schemas),
      schemas: adapter.buildSchemas(registry.schemas),
    },
    info: openapi.info,
    openapi: '3.1.0',
    paths,
  }
}
