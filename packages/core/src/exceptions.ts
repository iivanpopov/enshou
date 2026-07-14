import type { ErrorHandler } from 'hono/types'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

import { HTTPException } from 'hono/http-exception'

import type { Class } from '#shared/types'

export type HonoErrorHandler = ErrorHandler

export interface EnshouErrorHandler {
  handle: HonoErrorHandler
}

export type ErrorHandlerDefinition = Class<EnshouErrorHandler> | HonoErrorHandler

interface RestExceptionOptions {
  payload?: unknown
  headers?: HeadersInit
  message?: string
  cause?: unknown
}

export class RestException extends HTTPException {
  constructor(status: ContentfulStatusCode, options: RestExceptionOptions = {}) {
    let res: Response | undefined = undefined

    if (options.payload) res = Response.json(options.payload, { status, headers: options.headers })
    if (!options.payload && options.headers)
      res = new Response(null, { status, headers: options.headers })

    super(status, {
      res,
      cause: options.cause,
      message: options.message,
    })
  }
}

export class ValidationException extends RestException {
  constructor(issues: { path: string[]; message: string }[]) {
    super(422, { payload: { message: 'Validation failed.', issues } })
  }
}
