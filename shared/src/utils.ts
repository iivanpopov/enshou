import type { Class } from './types'

export function isClass(fn: any): fn is Class<any> {
  return (
    typeof fn === 'function' &&
    !!fn.prototype &&
    !Object.getOwnPropertyDescriptor(fn, 'prototype')?.writable
  )
}

export function normalizePath(path: string): string {
  const normalized = path.trim().replace(/\/+/g, '/')
  if (normalized === '' || normalized === '/') return '/'
  const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash.slice(0, -1) : withLeadingSlash
}
