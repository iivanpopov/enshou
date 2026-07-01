import type { Class } from '@enshou/core'

import { normalizePath } from '@enshou/core'

import type {
  JsonSchema,
  OpenApiBuilderOptions,
  OpenApiDocument,
  OperationMeta,
  SchemaConverter,
  TagMeta,
} from './types'

import { getOpenApiMeta } from './decorators'
import { getSchemaName } from './schema'

const PARAMETER_TARGETS = {
  query: 'query',
  param: 'path',
  header: 'header',
  cookie: 'cookie',
}

const BODY_TARGETS = {
  json: 'application/json',
  form: 'multipart/form-data',
}

export class OpenApiBuilder {
  private readonly controllers: Class<any>[]
  private readonly converter: SchemaConverter
  private readonly options: OpenApiBuilderOptions
  private readonly componentSchemas = new Map<string, JsonSchema>()

  constructor(options: OpenApiBuilderOptions) {
    this.controllers = options.controllers
    this.converter = options.schemaConverter
    this.options = options

    if (options.schemas) {
      for (const [name, schema] of Object.entries(options.schemas)) {
        this.componentSchemas.set(name, this.converter.toJsonSchema(schema))
      }
    }
  }

  toDocument(): OpenApiDocument {
    const paths: Record<string, Record<string, unknown>> = {}
    const tags: TagMeta[] = []

    for (const controller of this.controllers) {
      const metadata = controller[Symbol.metadata]
      if (!metadata) continue

      const prefix = (metadata.prefix as string) ?? '/'
      const routes = (metadata.routes as Map<string, any>) ?? new Map()
      const openapi = metadata.openapi as ReturnType<typeof getOpenApiMeta> | undefined

      if (openapi?.tag) tags.push(openapi.tag)

      for (const [handlerName, route] of routes.entries()) {
        const fullPath = this.toOpenApiPath(normalizePath(`${prefix}/${route.path}`))
        const method = (route.method as string).toLowerCase()
        const operationMeta = openapi?.operations.get(handlerName)

        paths[fullPath] ??= {}
        paths[fullPath][method] = this.buildOperation(route, operationMeta, openapi)
      }
    }

    const document: OpenApiDocument = {
      openapi: '3.1.0',
      info: this.options.info,
      paths,
    }

    if (this.options.servers?.length) document.servers = this.options.servers

    if (tags.length > 0) document.tags = tags

    if (this.componentSchemas.size > 0 || this.options.securitySchemes) {
      document.components = {}

      if (this.componentSchemas.size > 0)
        document.components.schemas = Object.fromEntries(this.componentSchemas)

      if (this.options.securitySchemes)
        document.components.securitySchemes = this.options.securitySchemes
    }

    return document
  }

  private buildOperation(
    route: { method: string; path: string; schema?: Record<string, any> },
    operationMeta: OperationMeta | undefined,
    controllerMeta: { tag?: TagMeta; security?: Record<string, string[]>[] } | undefined,
  ): Record<string, unknown> {
    const operation: Record<string, unknown> = {}

    const tagList = operationMeta?.tags ?? (controllerMeta?.tag ? [controllerMeta.tag.name] : [])
    if (tagList.length > 0) operation.tags = tagList

    if (operationMeta?.summary) operation.summary = operationMeta.summary
    if (operationMeta?.description) operation.description = operationMeta.description
    if (operationMeta?.operationId) operation.operationId = operationMeta.operationId
    if (operationMeta?.deprecated) operation.deprecated = true

    const schema = operationMeta?.schema ?? route.schema
    if (schema) {
      const parameters = this.buildParameters(schema)
      if (parameters.length > 0) operation.parameters = parameters

      const requestBody = this.buildRequestBody(schema, operationMeta)
      if (requestBody) operation.requestBody = requestBody
    }

    operation.responses = this.buildResponses(operationMeta)

    const security = operationMeta?.security ?? controllerMeta?.security
    if (security) operation.security = security

    return operation
  }

  private buildParameters(schema: Record<string, any>): Record<string, unknown>[] {
    const parameters: Record<string, unknown>[] = []

    for (const [target, openApiIn] of Object.entries(PARAMETER_TARGETS)) {
      const targetSchema = schema[target]
      if (!targetSchema) continue

      const jsonSchema = this.resolveSchema(targetSchema)
      const properties = jsonSchema.properties as Record<string, JsonSchema> | undefined
      const required = (jsonSchema.required as string[]) ?? []

      if (!properties) continue

      for (const [name, propSchema] of Object.entries(properties)) {
        const param: Record<string, unknown> = {
          name,
          in: openApiIn,
          schema: propSchema,
        }

        if (required.includes(name)) param.required = true
        if (openApiIn === 'path') param.required = true

        parameters.push(param)
      }
    }

    return parameters
  }

  private buildRequestBody(
    schema: Record<string, any>,
    operationMeta?: OperationMeta,
  ): Record<string, unknown> | undefined {
    const content: Record<string, unknown> = {}
    let hasBody = false

    for (const [target, contentType] of Object.entries(BODY_TARGETS)) {
      const targetSchema = schema[target]
      if (!targetSchema) continue

      hasBody = true
      content[contentType] = {
        schema: this.resolveSchema(targetSchema),
      }
    }

    if (!hasBody) return undefined

    return {
      required: operationMeta?.requestBodyRequired ?? true,
      content,
    }
  }

  private buildResponses(operationMeta: OperationMeta | undefined): Record<string, unknown> {
    if (!operationMeta?.responses || Object.keys(operationMeta.responses).length === 0) {
      return { 200: { description: 'Successful response' } }
    }

    const responses: Record<string, unknown> = {}

    for (const [statusCode, responseMeta] of Object.entries(operationMeta.responses)) {
      const response: Record<string, unknown> = {
        description: responseMeta.description,
      }

      if (responseMeta.schema) {
        response.content = {
          [responseMeta.contentType ?? 'application/json']: {
            schema: this.resolveSchema(responseMeta.schema),
          },
        }
      }

      responses[statusCode] = response
    }

    return responses
  }

  private resolveSchema(schema: unknown): JsonSchema {
    const name = getSchemaName(schema)

    if (!name) return this.converter.toJsonSchema(schema)

    if (!this.componentSchemas.has(name)) {
      this.componentSchemas.set(name, this.converter.toJsonSchema(schema))
    }

    return { $ref: `#/components/schemas/${name}` }
  }

  private toOpenApiPath(path: string): string {
    return path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '{$1}')
  }
}
