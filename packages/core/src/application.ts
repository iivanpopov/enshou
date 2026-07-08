import type { Provider } from '@enshou/di'

import { Container, createToken } from '@enshou/di'
import { Hono } from 'hono'

import type { Class } from '#shared/types'

import { isClass, normalizePath } from '#shared/utils'

import type { EnshouErrorHandler, HonoErrorHandler } from './exceptions'
import type { MiddlewareDefinition } from './middleware'

import { asControllerMetadata } from './metadata'

export interface ApplicationOptions {
  basePath?: string
  controllers?: Class<any>[]
  providers?: Provider<unknown>[]
  middlewares?: MiddlewareDefinition[]
  errorHandler?: Class<EnshouErrorHandler> | HonoErrorHandler
}

export class Application {
  public readonly container: Container = new Container()

  public basePath: string
  public controllers: Class<any>[]
  public providers: Provider<unknown>[]
  public middlewares: MiddlewareDefinition[]
  public errorHandler?: Class<EnshouErrorHandler> | HonoErrorHandler

  constructor(options: ApplicationOptions) {
    this.basePath = options.basePath ?? ''
    this.controllers = options.controllers ?? []
    this.providers = options.providers ?? []
    this.middlewares = options.middlewares ?? []
    this.errorHandler = options.errorHandler
  }

  private async _resolveMiddlewares(middlewares: MiddlewareDefinition[]) {
    return await Promise.all(
      middlewares.map(async (middleware) => {
        if (typeof middleware !== 'symbol') return middleware
        const instance = await this.container.resolveAsync<any>(middleware)
        return instance.handle.bind(instance)
      }),
    )
  }

  async instantiate(): Promise<Hono> {
    const app = new Hono()

    for (const provider of this.providers) this.container.register(provider)

    const appMiddlewares = await this._resolveMiddlewares(this.middlewares)

    for (const controller of this.controllers) {
      const metadata = asControllerMetadata(controller[Symbol.metadata])
      this.container.registerClass(metadata.token, controller)
      const instance = await this.container.resolveAsync<any>(metadata.token)

      const controllerMiddlewares = await this._resolveMiddlewares(metadata.middlewares)

      for (const [handler, route] of metadata.routes.entries()) {
        const routeMiddlewares = await this._resolveMiddlewares(route.middlewares)

        app.on(
          route.method,
          normalizePath(`${this.basePath}/${metadata.prefix}/${route.path}`) as any,
          ...appMiddlewares,
          ...controllerMiddlewares,
          ...routeMiddlewares,
          instance[handler].bind(instance),
        )
      }
    }

    if (isClass(this.errorHandler)) {
      const token = createToken<EnshouErrorHandler>(this.errorHandler.name)
      this.container.registerClass(token, this.errorHandler)
      const instance = await this.container.resolveAsync(token)
      app.onError(instance.handle.bind(instance))
    } else if (this.errorHandler) app.onError(this.errorHandler)

    return app
  }
}
