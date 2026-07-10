import type { CronWithAutocomplete } from 'bun'

export interface CronMetadata {
  jobs: Map<string, CronWithAutocomplete>
}

export function asCronMetadata(metadata: any): CronMetadata {
  metadata.jobs ??= new Map()
  return metadata
}
