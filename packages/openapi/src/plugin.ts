import type { Plugin, PluginInitContext } from '@enshou/core'

import type { OpenApiAdapter, OpenApiOptions } from './build-document'
import type { ComponentsRegistry } from './components'
import type { ScalarOptions } from './scalar'

import { buildDocument } from './build-document'
import { scalarUi } from './scalar'

export interface OpenApiPluginOptions {
  adapter: OpenApiAdapter
  openapi: OpenApiOptions & {
    path: string
  }
  scalar?: ScalarOptions & { path: string }
  registry?: ComponentsRegistry
}

export function OpenApiPlugin({
  adapter,
  openapi,
  scalar,
  registry,
}: OpenApiPluginOptions): Plugin {
  return {
    init({ hono, options }: PluginInitContext) {
      const document = buildDocument({ adapter, modules: options.modules, openapi, registry })

      hono.get(openapi.path, (c) => {
        return c.json(document)
      })
      if (scalar) {
        const { path, ...rest } = scalar
        hono.get(path, scalarUi(openapi.path, rest))
      }
    },
  }
}
