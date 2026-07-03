import { expect, it } from 'bun:test'

import { createToken, Inject } from '../src'

it('should inject metadata on class', () => {
  const TOKEN = createToken('token')

  @Inject(TOKEN)
  class Class {}

  expect((Class as any)[(Symbol as any).metadata]?.injects).toEqual([TOKEN])
})

it('should support rest parameters', () => {
  const TOKEN1 = createToken('token')
  const TOKEN2 = createToken('token')

  @Inject(TOKEN1, TOKEN2)
  class Class {}

  expect((Class as any)[(Symbol as any).metadata]?.injects).toEqual([TOKEN1, TOKEN2])
})
