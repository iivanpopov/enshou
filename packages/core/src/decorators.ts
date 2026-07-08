import { createToken } from '@enshou/di'

import type { AnyFunction } from '#shared/types'

import type { HttpMethod } from './metadata'
import type { MiddlewareDefinition } from './middleware'

import { asControllerMetadata } from './metadata'

export function Controller(prefix: string = '/') {
  return function (_target: any, context: ClassDecoratorContext): void {
    const metadata = asControllerMetadata(context.metadata)
    metadata.prefix = prefix
    metadata.token = createToken(context.name!)
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
      const controllerMetadata = asControllerMetadata(context.metadata)

      const handlerName = String(context.name)
      const handlerMetadata = controllerMetadata.routes.get(handlerName)

      if (!handlerMetadata) {
        controllerMetadata.routes.set(handlerName, { method, path, middlewares: [] })
      } else if (handlerMetadata && !!handlerMetadata.middlewares.length)
        controllerMetadata.routes.set(handlerName, { ...handlerMetadata, method, path })

      if (context.kind === 'method') return

      return (initialValue: AnyFunction) => initialValue
    }

    return decorator
  }
}

export const Get: RouteDecoratorFactory = createMethodDecorator('GET')
export const Post: RouteDecoratorFactory = createMethodDecorator('POST')
export const Put: RouteDecoratorFactory = createMethodDecorator('PUT')
export const Patch: RouteDecoratorFactory = createMethodDecorator('PATCH')
export const Delete: RouteDecoratorFactory = createMethodDecorator('DELETE')

export function Use(...middlewares: MiddlewareDefinition[]) {
  return function (
    _value: any,
    context: ClassDecoratorContext | ClassMethodDecoratorContext | ClassFieldDecoratorContext,
  ): void {
    const controllerMetadata = asControllerMetadata(context.metadata)

    if (context.kind === 'class') {
      controllerMetadata.middlewares.unshift(...middlewares)
      return
    }

    const handlerName = String(context.name)
    const routeMetadata = controllerMetadata.routes.get(handlerName)

    routeMetadata!.middlewares.unshift(...middlewares)
  }
}
