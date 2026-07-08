import type { Class } from '#shared/types'

import type { Token } from './token'

export type Scope = 'singleton' | 'transient'

export interface ResolutionFrame {
  token: Token
  kind: 'class' | 'factory' | 'value'
  useClass?: Class<unknown>
}

export interface ResolutionContext {
  token: Token
  stack: ReadonlyArray<ResolutionFrame>
  parent?: ResolutionFrame
  root?: ResolutionFrame
}

export interface ClassProvider<T> {
  provide: Token<T>
  useClass: Class<T>
  scope?: Scope
}

export interface ValueProvider<T> {
  provide: Token<T>
  useValue: T
}

export type UseFactory<T> = (container: Container, context: ResolutionContext) => Promise<T> | T

export interface FactoryProvider<T> {
  provide: Token<T>
  useFactory: UseFactory<T>
  scope?: Scope
}

export type Provider<T> = ClassProvider<T> | ValueProvider<T> | FactoryProvider<T>

interface RegisteredClassProvider {
  kind: 'class'
  useClass: Class<any>
  scope: Scope
}

interface RegisteredFactoryProvider {
  kind: 'factory'
  useFactory: UseFactory<any>
  scope: Scope
}

type RegisteredProvider = RegisteredClassProvider | RegisteredFactoryProvider

export class Container {
  private readonly providers: Map<Token, RegisteredProvider> = new Map()
  private readonly singletonCache: Map<Token, unknown> = new Map()

  register<T>(provider: Provider<T>): void {
    this.singletonCache.delete(provider.provide)

    if ('useValue' in provider) {
      this.singletonCache.set(provider.provide, provider.useValue)
      return
    }

    if ('useFactory' in provider) {
      this.providers.set(provider.provide, {
        kind: 'factory',
        useFactory: provider.useFactory,
        scope: provider.scope || 'singleton',
      })
      return
    }

    this.providers.set(provider.provide, {
      kind: 'class',
      useClass: provider.useClass,
      scope: provider.scope || 'singleton',
    })
  }

  registerValue<T>(token: Token<T>, value: T): void {
    this.register({ provide: token, useValue: value })
  }

  registerClass<T>(token: Token<T>, value: Class<T>, scope: Scope = 'singleton'): void {
    this.register({ provide: token, useClass: value, scope })
  }

  registerFactory<T>(token: Token<T>, factory: UseFactory<T>, scope: Scope = 'singleton'): void {
    this.register({ provide: token, useFactory: factory, scope })
  }

  isRegistered<T>(token: Token<T>): boolean {
    return this.providers.has(token) || this.singletonCache.has(token)
  }

  resolve<T>(token: Token<T>): T {
    return this._resolve(token, [])
  }

  resolveAsync<T>(token: Token<T>): Promise<T> {
    return this._resolveAsync(token, [])
  }

  private _resolve<T>(token: Token<T>, stack: ResolutionFrame[]): T {
    if (this.singletonCache.has(token)) return this.singletonCache.get(token) as T

    for (let i = 0; i < stack.length; i++)
      if (stack[i].token === token) throw Error(`Circular dependency ${String(token)}`)

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
          parent: stack.length >= 2 ? stack[stack.length - 2] : undefined,
          root: stack[0],
        }

        const scoped = Object.create(this) as Container
        Object.defineProperty(scoped, 'resolve', {
          value: (t: Token) => this._resolve(t, stack),
        })

        value = provider.useFactory(scoped, context)
      } else {
        const metadata = (provider.useClass as any)[Symbol.metadata]
        const deps = metadata?.injects?.map((t: Token) => this._resolve(t, stack)) ?? []
        value = new provider.useClass(...deps)
      }

      if (provider.scope === 'singleton') this.singletonCache.set(token, value)

      value.onModuleInit?.()

      return value as T
    } finally {
      stack.pop()
    }
  }

  private async _resolveAsync<T>(token: Token<T>, stack: ResolutionFrame[]): Promise<T> {
    if (this.singletonCache.has(token)) return this.singletonCache.get(token) as T

    for (let i = 0; i < stack.length; i++)
      if (stack[i].token === token) throw Error(`Circular dependency ${String(token)}`)

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
          parent: stack.length >= 2 ? stack[stack.length - 2] : undefined,
          root: stack[0],
        }

        const scoped = Object.create(this) as Container
        Object.defineProperty(scoped, 'resolve', {
          value: (t: Token) => this._resolve(t, stack),
        })
        Object.defineProperty(scoped, 'resolveAsync', {
          value: (t: Token) => this._resolveAsync(t, stack),
        })

        value = await provider.useFactory(scoped, context)
      } else {
        const metadata = (provider.useClass as any)[Symbol.metadata]
        const depsPromises = metadata?.injects?.map((t: Token) => this._resolveAsync(t, stack))
        const deps = await Promise.all(depsPromises ?? [])
        value = new provider.useClass(...deps)
      }

      if (provider.scope === 'singleton') this.singletonCache.set(token, value)

      await value.onModuleInit?.()

      return value as T
    } finally {
      stack.pop()
    }
  }
}
