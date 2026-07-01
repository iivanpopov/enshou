import type { UserConfig } from 'tsdown'

export const tsdownConfig: UserConfig = {
  entry: 'src/index.ts',
  clean: true,
  dts: { oxc: true },
}
