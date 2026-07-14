import type { Plugin } from '@enshou/core'

import type { OpenApiInfo, OpenApiServer, SecurityScheme, SchemaResolver } from './types'

import { ui } from './ui'

export interface OpenapiOptions {
  resolver: SchemaResolver
  info: OpenApiInfo
  path?: string
  servers?: OpenApiServer[]
  schemas?: Record<string, unknown>
  securitySchemes?: Record<string, SecurityScheme>
}

export interface ScalarOptions {
  path: string
  title?: string
  cdn?: string
  theme?: string
}

export interface OpenApiPluginOptions {
  openapi?: OpenapiOptions
  scalar?: ScalarOptions
}

export function OpenApiPlugin({ openapi, scalar }: OpenApiPluginOptions): Plugin {
  return {
    onApplicationInit: ({ hono, options: { controllers } }) => {
      if (!openapi || !controllers.length) return

      // const document = buildDocument({ ...openapi, controllers })

      const openapiPath = openapi.path ?? '/openapi.json'
      hono.get(openapiPath, (c) => c.json(''))

      if (scalar?.path) hono.get(scalar.path, ui({ ...scalar, openapiPath }))
    },
  }
}
