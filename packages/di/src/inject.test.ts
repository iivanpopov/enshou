import { expect, it } from 'bun:test'

import { Inject } from './inject'
import { createToken } from './token'

it('should add inject metadata', () => {
  const TOKEN1 = createToken()
  const TOKEN2 = createToken()

  @Inject(TOKEN1, TOKEN2)
  class Class {}

  expect((Class as any)[(Symbol as any).metadata]?.injects).toEqual([TOKEN1, TOKEN2])
})
