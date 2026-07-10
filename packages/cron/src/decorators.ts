import type { CronWithAutocomplete } from 'bun'

import type { AnyFunction } from '#shared/types'

import { asCronMetadata } from './metadata'

type CronDecorator = {
  (_value: AnyFunction, context: ClassMethodDecoratorContext<object, AnyFunction>): void
  (
    _value: undefined,
    context: ClassFieldDecoratorContext<object, AnyFunction>,
  ): (initialValue: AnyFunction) => AnyFunction
}

export function Cron(pattern: CronWithAutocomplete): CronDecorator {
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
    const controllerMetadata = asCronMetadata(context.metadata)

    const methodName = String(context.name)

    controllerMetadata.jobs.set(methodName, pattern)

    if (context.kind === 'method') return

    return (initialValue: AnyFunction) => initialValue
  }

  return decorator
}
