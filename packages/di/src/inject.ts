import type { Token } from './token'

export type Class<T> = new (...args: any[]) => T

export function Inject(...tokens: Array<Token<any>>) {
  return function (_target: any, context: ClassDecoratorContext): void {
    context.metadata.injects = tokens
  }
}
