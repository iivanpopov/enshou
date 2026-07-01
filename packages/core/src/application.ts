import type { Provider } from '@enshou/di'
import type { ErrorHandler as HonoErrorHandler, MiddlewareHandler } from 'hono'

import { Container, createToken } from '@enshou/di'
import { Hono } from 'hono'

import type { EnshouErrorHandler } from './exceptions'
import type { MiddlewareDefinition } from './middleware'
import type { Class } from './utils'

import { asControllerMetadata } from './metadata'
import { normalizePath } from './utils'

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

  async instantiate(): Promise<Hono> {
    const app = new Hono()

    for (const provider of this.providers) this.container.register(provider)

    const getMiddleware = async (definition: MiddlewareDefinition): Promise<MiddlewareHandler> => {
      if (typeof definition !== 'symbol') return definition as MiddlewareHandler
      const instance = await this.container.resolveAsync<any>(definition)
      return instance.handle.bind(instance)
    }

    const appMiddlewares = await Promise.all(this.middlewares.map(getMiddleware))

    for (const controller of this.controllers) {
      const metadata = asControllerMetadata(controller[Symbol.metadata])
      this.container.registerClass(metadata.token, controller)
      const instance = await this.container.resolveAsync<any>(metadata.token)

      const controllerMiddlewares = await Promise.all(metadata.middlewares.map(getMiddleware))

      for (const [handlerName, route] of metadata.routes.entries()) {
        const routeMiddlewares = await Promise.all(route.middlewares.map(getMiddleware))

        app.on(
          route.method,
          normalizePath(`${this.basePath}/${metadata.prefix}/${route.path}`) as any,
          ...appMiddlewares,
          ...controllerMiddlewares,
          ...routeMiddlewares,
          instance[handlerName].bind(instance),
        )
      }
    }

    if (this.errorHandler?.prototype && 'handle' in this.errorHandler.prototype) {
      const token = createToken<EnshouErrorHandler>(this.errorHandler.name)
      this.container.registerClass(token, this.errorHandler as any)
      const errorHandlerInstance = await this.container.resolveAsync(token)
      app.onError(errorHandlerInstance.handle.bind(errorHandlerInstance))
    } else if (this.errorHandler) app.onError(this.errorHandler as any)

    return app
  }
}
