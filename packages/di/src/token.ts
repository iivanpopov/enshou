export type Token<T = unknown> = symbol & { __for: T }

export function createToken<T = unknown>(description = ''): Token<T> {
  return Symbol(description) as Token<T>
}
