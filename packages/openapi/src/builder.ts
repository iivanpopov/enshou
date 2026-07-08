import type { Class } from '#shared/types'

import { compactObject, normalizePath } from '#shared/utils'

import type {
  JsonSchema,
  OpenApiBuilderOptions,
  OpenApiDocument,
  OperationMeta,
  SchemaConverter,
  TagMeta,
} from './types'

import { asControllerMetadata } from './decorators'
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
  private readonly componentSchemas = new Map<string, JsonSchema>()

  constructor(private readonly options: OpenApiBuilderOptions) {
    this.controllers = options.controllers
    this.converter = options.schemaConverter

    if (options.schemas)
      for (const [name, schema] of Object.entries(options.schemas))
        this.componentSchemas.set(name, this.converter.toJsonSchema(schema))
  }

  toDocument(): OpenApiDocument {
    return compactObject({
      openapi: '3.1.0',
      info: this.options.info,
      servers: this.options.servers?.length ? this.options.servers : undefined,
      paths: this.buildPaths(),
      tags: this.collectTags(),
      components: this.buildComponents(),
    }) as OpenApiDocument
  }

  private buildPaths(): Record<string, Record<string, unknown>> {
    const paths: Record<string, Record<string, unknown>> = {}

    for (const controller of this.controllers) {
      const metadata = controller[Symbol.metadata]
      if (!metadata) continue

      const prefix = (metadata.prefix as string) ?? '/'
      const routes = (metadata.routes as Map<string, any>) ?? new Map()
      const openapi = asControllerMetadata(metadata).openapi

      for (const [handlerName, route] of routes.entries()) {
        const fullPath = this.toOpenApiPath(normalizePath(`${prefix}/${route.path}`))
        const method = (route.method as string).toLowerCase()
        const operationMeta = openapi?.operations.get(handlerName)

        paths[fullPath] ??= {}
        paths[fullPath][method] = this.buildOperation(route, operationMeta, openapi)
      }
    }

    return paths
  }

  private collectTags(): TagMeta[] {
    return this.controllers.flatMap((controller) => {
      const metadata = controller[Symbol.metadata]
      const tag = metadata ? asControllerMetadata(metadata).openapi?.tag : undefined
      return tag ? [tag] : []
    })
  }

  private buildComponents(): Record<string, unknown> | undefined {
    if (!this.componentSchemas.size && !this.options.securitySchemes) return undefined

    return compactObject({
      schemas: this.componentSchemas.size ? Object.fromEntries(this.componentSchemas) : undefined,
      securitySchemes: this.options.securitySchemes,
    })
  }

  private buildOperation(
    route: { method: string; path: string; schema?: Record<string, any> },
    operationMeta: OperationMeta | undefined,
    controllerMeta: { tag?: TagMeta; security?: Record<string, string[]>[] } | undefined,
  ): Record<string, unknown> {
    const tagList = operationMeta?.tags ?? (controllerMeta?.tag ? [controllerMeta.tag.name] : [])
    const schema = operationMeta?.schema ?? route.schema
    const parameters = schema ? this.buildParameters(schema) : []
    const requestBody = schema ? this.buildRequestBody(schema, operationMeta) : undefined

    return compactObject({
      tags: tagList.length ? tagList : undefined,
      summary: operationMeta?.summary,
      description: operationMeta?.description,
      operationId: operationMeta?.operationId,
      deprecated: operationMeta?.deprecated || undefined,
      parameters: parameters.length ? parameters : undefined,
      requestBody,
      responses: this.buildResponses(operationMeta),
      security: operationMeta?.security ?? controllerMeta?.security,
    })
  }

  private buildParameters(schema: Record<string, any>): Record<string, unknown>[] {
    return Object.entries(PARAMETER_TARGETS).flatMap(([target, openApiIn]) => {
      const targetSchema = schema[target]
      if (!targetSchema) return []

      const jsonSchema = this.resolveSchema(targetSchema)
      const properties = (jsonSchema.properties as Record<string, JsonSchema>) || {}
      const required = (jsonSchema.required as string[]) ?? []

      return Object.entries(properties).map(([name, propSchema]) =>
        compactObject({
          name,
          in: openApiIn,
          schema: propSchema,
          required: required.includes(name) || openApiIn === 'path' || undefined,
        }),
      )
    })
  }

  private buildRequestBody(
    schema: Record<string, any>,
    operationMeta?: OperationMeta,
  ): Record<string, unknown> | undefined {
    const entries = Object.entries(BODY_TARGETS).flatMap(([target, contentType]) => {
      const targetSchema = schema[target]
      return targetSchema ? [[contentType, { schema: this.resolveSchema(targetSchema) }]] : []
    })

    if (entries.length === 0) return undefined

    return {
      required: operationMeta?.requestBodyRequired ?? true,
      content: Object.fromEntries(entries),
    }
  }

  private buildResponses(operationMeta: OperationMeta | undefined): Record<string, unknown> {
    if (!operationMeta?.responses || Object.keys(operationMeta.responses).length === 0)
      return { 200: { description: 'Successful response' } }

    return Object.fromEntries(
      Object.entries(operationMeta.responses).map(([statusCode, responseMeta]) => [
        statusCode,
        compactObject({
          description: responseMeta.description,
          content: responseMeta.schema
            ? {
                [responseMeta.contentType ?? 'application/json']: {
                  schema: this.resolveSchema(responseMeta.schema),
                },
              }
            : undefined,
        }),
      ]),
    )
  }

  private resolveSchema(schema: unknown): JsonSchema {
    const name = getSchemaName(schema)

    if (!name) return this.converter.toJsonSchema(schema)

    if (!this.componentSchemas.has(name))
      this.componentSchemas.set(name, this.converter.toJsonSchema(schema))

    return { $ref: `#/components/schemas/${name}` }
  }

  private toOpenApiPath(path: string): string {
    return path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '{$1}')
  }
}
