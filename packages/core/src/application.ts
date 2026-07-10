import type { Provider } from '@enshou/di'
import type { MiddlewareHandler } from 'hono'

import { Container, createToken } from '@enshou/di'
import { Hono } from 'hono'

import type { Class } from '#shared/types'

import { asControllerMetadata } from '#shared/metadata'
import { isClass, normalizePath } from '#shared/utils'

import type { EnshouErrorHandler, ErrorHandlerDefinition, HonoErrorHandler } from './exceptions'
import type { Middleware, MiddlewareDefinition } from './middleware'
import type { PluginDefinition } from './plugin'

export interface ApplicationOptions {
  container?: Container
  basePath?: string
  controllers?: Class<any>[]
  providers?: Provider<any>[]
  middlewares?: MiddlewareDefinition[]
  plugins?: PluginDefinition[]
  errorHandler?: ErrorHandlerDefinition
}

export class Application {
  constructor(public readonly options: ApplicationOptions) {}

  private async _resolveMiddlewares(
    middlewares: MiddlewareDefinition[],
  ): Promise<MiddlewareHandler[]> {
    return await Promise.all(
      middlewares.map(async (middleware) => {
        if (typeof middleware !== 'symbol') return middleware
        const instance = await this.options.container.resolveAsync<Middleware>(middleware)
        return instance.handle.bind(instance)
      }),
    )
  }

  async instantiate(): Promise<Hono> {
    const hono = new Hono()

    for (const provider of this.options.providers) {
      this.options.container.register(provider)
    }

    const appMiddlewares = await this._resolveMiddlewares(this.options.middlewares)

    for (const controller of this.options.controllers) {
      const metadata = asControllerMetadata(controller[Symbol.metadata])
      this.options.container.registerClass(metadata.token, controller)
      const instance = await this.options.container.resolveAsync<any>(metadata.token)

      const controllerMiddlewares = await this._resolveMiddlewares(metadata.middlewares)

      for (const [handlerName, route] of metadata.routes.entries()) {
        const routeMiddlewares = await this._resolveMiddlewares(route.middlewares)

        hono.on(
          route.method,
          normalizePath(`${this.options.basePath}/${metadata.prefix}/${route.path}`) as any,
          ...appMiddlewares,
          ...controllerMiddlewares,
          ...routeMiddlewares,
          instance[handlerName].bind(instance),
        )
      }
    }

    if (isClass(this.options.errorHandler)) {
      const token = createToken<EnshouErrorHandler>(this.options.errorHandler.name)
      this.options.container.registerClass(token, this.options.errorHandler)
      const errorHandler = await this.options.container.resolveAsync(token)
      hono.onError(errorHandler.handle.bind(errorHandler))
    } else if (typeof this.options.errorHandler === 'function') {
      hono.onError(this.options.errorHandler)
    }

    for (const plugin of this.options.plugins) {
      await plugin.onApplicationInit({
        application: this,
        hono,
        options: this.options,
      })
    }

    return hono
  }
}
