import type { Class } from '#shared/types'

export type Scope = 'singleton' | 'transient'

export type Token<Value> = symbol & { __type: Value }

export interface ClassProvider<Value> {
  provide: Token<Value>
  useClass: Class<Value>
  scope?: Scope
}

export interface ValueProvider<Value> {
  provide: Token<Value>
  useValue: Value
}

export interface ResolutionFrame {
  token: Token<unknown>
  kind: 'class' | 'factory' | 'value'
  useClass?: Class
}
export interface ResolutionContext {
  token: Token<unknown>
  stack: ReadonlyArray<ResolutionFrame>
  parent?: ResolutionFrame
  root?: ResolutionFrame
}
export type UseFactory<Value = unknown> = (
  container: Container,
  context: ResolutionContext,
) => Value | Promise<Value>
export interface FactoryProvider<Value> {
  provide: Token<Value>
  useFactory: UseFactory<Value>
  scope?: Scope
}

export type Provider<Value = unknown> =
  | ClassProvider<Value>
  | ValueProvider<Value>
  | FactoryProvider<Value>

export interface InjectMetadata {
  injects?: Record<string, Token<unknown>>
}

interface RegisteredClassProvider<T = unknown> {
  kind: 'class'
  useClass: Class<T>
  scope: Scope
}
interface RegisteredFactoryProvider<T = unknown> {
  kind: 'factory'
  useFactory: UseFactory<T>
  scope: Scope
}
type RegisteredProvider<T> = RegisteredClassProvider<T> | RegisteredFactoryProvider<T>

export class Container {
  private providers: Map<symbol, RegisteredProvider<unknown>> = new Map()
  private singletonCache: Map<symbol, unknown> = new Map()

  constructor(providers: Provider<any>[] = []) {
    providers.forEach(this.register.bind(this))
  }

  register(provider: Provider<any>): void {
    if ('useValue' in provider) {
      this.singletonCache.set(provider.provide, provider.useValue)
      return
    }

    if ('useFactory' in provider) {
      this.providers.set(provider.provide, {
        kind: 'factory',
        useFactory: provider.useFactory,
        scope: provider.scope ?? 'singleton',
      })
      return
    }

    this.providers.set(provider.provide, {
      kind: 'class',
      useClass: provider.useClass,
      scope: provider.scope ?? 'singleton',
    })
  }

  isRegistered(token: Token<unknown>): boolean {
    return this.providers.has(token) || this.singletonCache.has(token)
  }

  resolve<Value>(token: Token<Value>): Promise<Value> {
    if (typeof token !== 'symbol') throw Error(`Token ${String(token)} must be a symbol`)
    return this._resolve(token, [])
  }

  private async _resolve<T>(token: Token<T>, stack: ResolutionFrame[]): Promise<T> {
    if (this.singletonCache.has(token)) return this.singletonCache.get(token) as T

    for (const frame of stack)
      if (frame.token === token) throw Error(`Circular dependency ${String(token)}`)

    const provider = this.providers.get(token)
    if (!provider) throw Error(`No provider for ${String(token)}`)

    const frame: ResolutionFrame = {
      token,
      kind: provider.kind,
      useClass: provider.kind === 'class' ? provider.useClass : undefined,
    }
    stack.push(frame)

    try {
      let value: any

      if (provider.kind === 'factory') {
        const context: ResolutionContext = {
          token,
          stack,
          parent: stack.at(-2),
          root: stack.at(0),
        }

        const scoped = Object.create(this) as Container
        Object.defineProperty(scoped, 'resolve', {
          value: <V>(t: Token<V>) => this._resolve(t, stack),
        })

        value = await provider.useFactory(scoped, context)
      } else {
        value = new provider.useClass() as any
        const metadata = provider.useClass[Symbol.metadata] as InjectMetadata | undefined
        for (const [field, token] of Object.entries(metadata?.injects ?? {}))
          value[field] = await this._resolve(token, stack)
      }

      if (provider.scope === 'singleton') this.singletonCache.set(token, value)

      return value as T
    } finally {
      stack.pop()
    }
  }
}
