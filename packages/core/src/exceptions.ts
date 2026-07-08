import type { ErrorHandler } from 'hono/types'

import { HTTPException } from 'hono/http-exception'

export type HonoErrorHandler = ErrorHandler

export interface EnshouErrorHandler {
  handle: HonoErrorHandler
}
import type { ContentfulStatusCode } from 'hono/utils/http-status'

interface RestExceptionOptions {
  payload?: unknown
  headers?: HeadersInit
  message?: string
  cause?: unknown
}

export class RestException extends HTTPException {
  constructor(status: ContentfulStatusCode, options: RestExceptionOptions = {}) {
    super(status, {
      res:
        options.payload !== undefined
          ? Response.json(options.payload, { status, headers: options.headers })
          : undefined,
      cause: options.cause,
      message: options.message,
    })
  }
}
