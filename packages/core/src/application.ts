import type { MiddlewareHandler } from 'hono'

import { Hono } from 'hono'

import { asControllerMetadata } from '#shared/metadata'
import { isClass, normalizePath } from '#shared/utils'

import type { InjectMetadata, Provider, Token } from './container'
import type { EnshouErrorHandler, ErrorHandlerDefinition } from './exceptions'
import type { MiddlewareDefinition } from './middleware'
import type { Module } from './module'
import type { Plugin } from './plugin'

import { Container } from './container'

export interface ApplicationOptions {
  basePath?: string
  modules: Module[]
  providers?: Provider[]
  middlewares?: MiddlewareDefinition[]
  plugins?: Plugin[]
  errorHandler?: ErrorHandlerDefinition
}

export type ResolvedApplicationOptions = Required<Omit<ApplicationOptions, 'errorHandler'>> & {
  errorHandler?: ErrorHandlerDefinition
}

export class Application {
  public readonly container: Container = new Container()
  public readonly options: ResolvedApplicationOptions

  private _dependencyVisibility = new Map<symbol, Set<string>>()

  constructor({
    basePath = '',
    providers = [],
    middlewares = [],
    plugins = [],
    ...rest
  }: ApplicationOptions) {
    this.options = { basePath, providers, middlewares, plugins, ...rest }
  }

  async instantiate(): Promise<Hono> {
    const hono = new Hono()

    for (const provider of this.options.providers) {
      this._dependencyVisibility.set(provider.provide, new Set('global'))
      this.container.register(provider)
    }

    const appMiddlewares = await this._resolveMiddlewares(this.options.middlewares)

    for (const module of this.options.modules) {
      for (const provider of module.providers ?? []) {
        const visibility = this._dependencyVisibility.get(provider.provide)

        if (visibility?.has('global')) continue
        if (!visibility) this._dependencyVisibility.set(provider.provide, new Set())

        this._dependencyVisibility.get(provider.provide)?.add(module.name)

        this.container.register(provider)
      }

      for (const Controller of module.controllers) {
        const metadata = asControllerMetadata(Controller[Symbol.metadata])
        this.container.register({ provide: metadata.token, useClass: Controller })

        const injects = (metadata as InjectMetadata).injects
        for (const dependency of Object.values(injects ?? {})) {
          const visibility = this._dependencyVisibility.get(dependency)

          if (!visibility) continue

          if (!visibility.has('global') && !visibility.has(module.name))
            throw new Error(
              `Module '${module.name}' cannot use dependency '${dependency.description}'. This dependency is only available in: [${Array.from(visibility.values()).join(', ')}].`,
            )
        }

        const controllerMiddlewares = await this._resolveMiddlewares(metadata.middlewares)
        const instance = await this.container.resolve<any>(metadata.token)

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
    }

    if (isClass(this.options.errorHandler)) {
      const provide = Symbol(this.options.errorHandler.name) as Token<EnshouErrorHandler>
      this.container.register({ provide, useClass: this.options.errorHandler })
      const errorHandler = await this.container.resolve(provide)

      hono.onError(errorHandler.handle.bind(errorHandler))
    } else if (typeof this.options.errorHandler === 'function')
      hono.onError(this.options.errorHandler)

    for (const plugin of this.options.plugins)
      await plugin.init({ container: this.container, hono, options: this.options })

    return hono
  }

  private _resolveMiddlewares(middlewares: MiddlewareDefinition[]) {
    return Promise.all<MiddlewareHandler>(
      middlewares.map(async (middleware) => {
        if (typeof middleware !== 'symbol') return middleware
        const instance = await this.container.resolve(middleware)
        return instance.handle.bind(instance)
      }),
    )
  }
}
