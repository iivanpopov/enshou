if (!Symbol.metadata) (Symbol as any).metadata = Symbol.for('Symbol.metadata')

export * from './container'
export * from './inject'
export * from './token'
export type * from './lifecycle'
