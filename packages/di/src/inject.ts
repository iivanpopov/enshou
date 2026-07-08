import type { Token } from './token'

export function Inject(...tokens: Array<Token>) {
  return function (_target: any, context: ClassDecoratorContext): void {
    context.metadata.injects = tokens
  }
}
