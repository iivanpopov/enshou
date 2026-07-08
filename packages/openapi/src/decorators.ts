import type { OpenapiMetadata, OperationMeta, SecurityRequirement } from './types'

export function asControllerMetadata(metadata: any): OpenapiMetadata {
  metadata.openapi ??= {
    operations: new Map(),
  }

  return metadata
}

export function ApiTag(name: string, description?: string) {
  return function (_target: any, context: ClassDecoratorContext): void {
    const metadata = asControllerMetadata(context.metadata)

    metadata.openapi.tag = { name, description }
  }
}

export function ApiOperation(operation: OperationMeta) {
  return function (
    _value: any,
    context: ClassMethodDecoratorContext | ClassFieldDecoratorContext,
  ): void {
    const metadata = asControllerMetadata(context.metadata)

    const handlerName = String(context.name)
    const existing = metadata.openapi.operations.get(handlerName)

    if (existing) metadata.openapi.operations.set(handlerName, { ...existing, ...operation })
    else metadata.openapi.operations.set(handlerName, operation)
  }
}

export function ApiSecurity(...requirements: SecurityRequirement[]) {
  return function (
    _value: any,
    context: ClassDecoratorContext | ClassMethodDecoratorContext | ClassFieldDecoratorContext,
  ): void {
    const metadata = asControllerMetadata(context.metadata)

    if (context.kind === 'class') {
      metadata.openapi.security = requirements
      return
    }

    const handlerName = String(context.name)
    const existing = metadata.openapi.operations.get(handlerName)

    if (existing) existing.security = requirements
    else metadata.openapi.operations.set(handlerName, { security: requirements })
  }
}
