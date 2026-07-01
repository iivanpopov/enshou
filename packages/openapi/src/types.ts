export interface SchemaConverter {
  toJsonSchema(schema: any): JsonSchema
}

export type JsonSchema = Record<string, any>

export interface OpenApiInfo {
  title: string
  version: string
  description?: string
  termsOfService?: string
  contact?: { name?: string; url?: string; email?: string }
  license?: { name: string; url?: string }
}

export interface OpenApiServer {
  url: string
  description?: string
}

export interface SecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect'
  description?: string
  name?: string
  in?: 'query' | 'header' | 'cookie'
  scheme?: string
  bearerFormat?: string
}

export interface ResponseMeta {
  description: string
  schema?: unknown
  contentType?: string
}

export interface OperationMeta {
  summary?: string
  description?: string
  operationId?: string
  deprecated?: boolean
  tags?: string[]
  responses?: Record<number | string, ResponseMeta>
  security?: SecurityRequirement[]
  schema?: Record<string, any>
  requestBodyRequired?: boolean
}

export type SecurityRequirement = Record<string, string[]>

export interface TagMeta {
  name: string
  description?: string
}

export interface OpenApiControllerMeta {
  tag?: TagMeta
  operations: Map<string, OperationMeta>
  security?: SecurityRequirement[]
}

export interface OpenApiBuilderOptions {
  controllers: (new (...args: any[]) => any)[]
  schemaConverter: SchemaConverter
  info: OpenApiInfo
  servers?: OpenApiServer[]
  schemas?: Record<string, unknown>
  securitySchemes?: Record<string, SecurityScheme>
}

export interface OpenApiDocument {
  openapi: '3.1.0'
  info: OpenApiInfo
  servers?: OpenApiServer[]
  paths: Record<string, Record<string, unknown>>
  components?: {
    schemas?: Record<string, JsonSchema>
    securitySchemes?: Record<string, SecurityScheme>
  }
  tags?: TagMeta[]
}
