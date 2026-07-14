import type { Class } from '#shared/types'

import type { Provider } from './container'

export interface Module {
  name: string
  controllers: Class[]
  providers?: Provider[]
}
