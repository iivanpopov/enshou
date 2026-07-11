import { asControllerMetadata } from '#shared/metadata'
import { compactObject, normalizePath } from '#shared/utils'

import type {
  JsonSchema,
  BuildDocumentOptions,
  OpenApiDocument,
  OperationMeta,
  TagMeta,
} from './types'

import { getSchemaName } from './schema'

const PARAMETER_TARGETS = {
  query: 'query',
  param: 'path',
  header: 'header',
  cookie: 'cookie',
}

function toOpenApiPath(path: string): string {
  return path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '{$1}')
}

export function buildDocument({
  controllers,
  resolver,
  schemas,
  ...options
}: BuildDocumentOptions): OpenApiDocument {
  const componentSchemas = new Map<string, JsonSchema>()

  Object.entries(schemas || {}).forEach(([name, schema]) =>
    componentSchemas.set(name, resolver.toJson(schema)),
  )

  const resolveSchema = (schema: unknown): JsonSchema => {
    const name = getSchemaName(schema)
    if (!name) return resolver.toJson(schema)
    if (!componentSchemas.has(name)) componentSchemas.set(name, resolver.toJson(schema))
    return { $ref: `#/components/schemas/${name}` }
  }

  const buildParameters = (schema: Record<string, any>) =>
    Object.entries(PARAMETER_TARGETS).flatMap(([target, openApiIn]) => {
      const targetSchema = schema[target]
      if (!targetSchema) return []

      const jsonSchema = resolveSchema(targetSchema)
      const properties = jsonSchema.properties || {}
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

  const buildRequestBody = (
    routeSchema: Record<string, any> | undefined,
    operationMeta?: OperationMeta,
  ) => {
    if (!routeSchema) return

    let contentType: string
    let bodySchema: unknown

    if (routeSchema.json) {
      contentType = 'application/json'
      bodySchema = routeSchema.json
    } else if (routeSchema.form) {
      contentType = 'multipart/form-data'
      bodySchema = routeSchema.form
    } else return

    return {
      required: operationMeta?.requestBodyRequired ?? true,
      content: {
        [contentType]: { schema: resolveSchema(bodySchema) },
      },
    }
  }

  const buildResponses = (operationMeta: OperationMeta | undefined) => {
    if (!operationMeta?.responses || !Object.keys(operationMeta.responses).length)
      return { 200: { description: 'Successful response' } }

    return Object.fromEntries(
      Object.entries(operationMeta.responses).map(([statusCode, responseMeta]) => [
        statusCode,
        compactObject({
          description: responseMeta.description,
          content: responseMeta.schema && {
            [responseMeta.contentType ?? 'application/json']: {
              schema: resolveSchema(responseMeta.schema),
            },
          },
        }),
      ]),
    )
  }

  const buildOperation = (
    route: { method: string; path: string; schema?: Record<string, any> },
    operationMeta: OperationMeta | undefined,
    controllerMeta: { tag?: TagMeta; security?: Record<string, string[]>[] } | undefined,
  ) => {
    const tagList = operationMeta?.tags ?? (controllerMeta?.tag ? [controllerMeta.tag.name] : [])
    const schema = operationMeta?.schema ?? route.schema
    const parameters = schema ? buildParameters(schema) : []

    return compactObject({
      tags: tagList.length ? tagList : undefined,
      summary: operationMeta?.summary,
      description: operationMeta?.description,
      operationId: operationMeta?.operationId,
      deprecated: operationMeta?.deprecated || undefined,
      parameters: parameters.length ? parameters : undefined,
      requestBody: buildRequestBody(schema, operationMeta),
      responses: buildResponses(operationMeta),
      security: operationMeta?.security ?? controllerMeta?.security,
    })
  }

  const buildPaths = () => {
    const paths: Record<string, Record<string, unknown>> = {}

    for (const controller of controllers) {
      const metadata = asControllerMetadata(controller[Symbol.metadata])
      if (!metadata) continue

      for (const [handlerName, route] of metadata.routes.entries()) {
        const fullPath = toOpenApiPath(normalizePath(`${metadata.prefix}/${route.path}`))
        const method = route.method.toLowerCase()
        const operationMeta = metadata.openapi?.operations.get(handlerName)

        paths[fullPath] ??= {}
        paths[fullPath][method] = buildOperation(route, operationMeta, metadata.openapi)
      }
    }

    return paths
  }

  const collectTags = (): TagMeta[] =>
    controllers.flatMap((controller) => {
      const metadata = asControllerMetadata(controller[Symbol.metadata])
      const tag = metadata?.openapi?.tag
      return tag ? [tag] : []
    })

  const buildComponents = () =>
    compactObject({
      schemas: !!componentSchemas.size && Object.fromEntries(componentSchemas),
      securitySchemes: options.securitySchemes,
    })

  return compactObject({
    openapi: '3.1.0',
    info: options.info,
    servers: options.servers,
    paths: buildPaths(),
    tags: collectTags(),
    components: buildComponents(),
  }) as OpenApiDocument
}
