import type { Token } from '@enshou/di'

import type { MiddlewareDefinition } from './middleware'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD'

export interface RouteDefinition {
  method: HttpMethod
  path: string
  middlewares: MiddlewareDefinition[]
}

export interface ControllerMetadata {
  prefix: string
  routes: Map<string, RouteDefinition>
  middlewares: MiddlewareDefinition[]
  token: Token<any>
}

export function asControllerMetadata(metadata: any): ControllerMetadata {
  metadata.routes ??= new Map()
  metadata.middlewares ??= []
  return metadata
}
