import type { AnyFunction } from '#shared/types'

import { asControllerMetadata } from '#shared/metadata'

import type { MiddlewareDefinition } from './middleware'

export type HttpMethod = 'GET' | 'QUERY' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD'

import type { Token } from './container'

export function Inject<T>(token: Token<T>) {
  return function (_: unknown, context: ClassFieldDecoratorContext<unknown, T>): void {
    if (context.kind !== 'field') return
    context.metadata.injects ??= {}
    ;(context.metadata.injects as any)[context.name] = token
  }
}

export function Controller(prefix: string = '/') {
  return function (_target: any, context: ClassDecoratorContext): void {
    const metadata = asControllerMetadata(context.metadata)
    metadata.prefix = prefix
    metadata.token = Symbol(context.name)
  }
}

type RouteMethodDecorator = (
  value: AnyFunction,
  context: ClassMethodDecoratorContext<object, AnyFunction>,
) => void

type RouteFieldDecorator = (
  value: undefined,
  context: ClassFieldDecoratorContext<object, AnyFunction>,
) => (initialValue: AnyFunction) => AnyFunction

type RouteDecorator = RouteMethodDecorator & RouteFieldDecorator
type RouteDecoratorFactory = (path: string) => RouteDecorator

function createMethodDecorator(method: HttpMethod): RouteDecoratorFactory {
  return function (path: string) {
    function decorator(
      _value: AnyFunction,
      context: ClassMethodDecoratorContext<object, AnyFunction>,
    ): void
    function decorator(
      _value: undefined,
      context: ClassFieldDecoratorContext<object, AnyFunction>,
    ): (initialValue: AnyFunction) => AnyFunction
    function decorator(
      _value: AnyFunction | undefined,
      context:
        | ClassMethodDecoratorContext<object, AnyFunction>
        | ClassFieldDecoratorContext<object, AnyFunction>,
    ): void | ((initialValue: AnyFunction) => AnyFunction) {
      const metadata = asControllerMetadata(context.metadata)

      const handlerName = String(context.name)
      const handlerMetadata = metadata.routes.get(handlerName)

      if (!handlerMetadata) metadata.routes.set(handlerName, { method, path, middlewares: [] })
      else if (handlerMetadata?.middlewares.length)
        metadata.routes.set(handlerName, { ...handlerMetadata, method, path })

      if (context.kind === 'method') return

      return (initialValue: AnyFunction) => initialValue
    }

    return decorator
  }
}

export const Get: RouteDecoratorFactory = createMethodDecorator('GET')
export const Query: RouteDecoratorFactory = createMethodDecorator('QUERY')
export const Post: RouteDecoratorFactory = createMethodDecorator('POST')
export const Put: RouteDecoratorFactory = createMethodDecorator('PUT')
export const Patch: RouteDecoratorFactory = createMethodDecorator('PATCH')
export const Delete: RouteDecoratorFactory = createMethodDecorator('DELETE')

export function Use(...middlewares: MiddlewareDefinition[]) {
  return function (
    _value: any,
    context: ClassDecoratorContext | ClassMethodDecoratorContext | ClassFieldDecoratorContext,
  ): void {
    const metadata = asControllerMetadata(context.metadata)

    if (context.kind === 'class') {
      metadata.middlewares.unshift(...middlewares)
      return
    }

    const handlerName = String(context.name)
    const routeMetadata = metadata.routes.get(handlerName)

    routeMetadata!.middlewares.unshift(...middlewares)
  }
}
