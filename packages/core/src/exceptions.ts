import type { ErrorHandler } from 'hono/types'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

import { HTTPException } from 'hono/http-exception'

export type HonoErrorHandler = ErrorHandler

export interface EnshouErrorHandler {
  handle: HonoErrorHandler
}

export class EnshouException extends Error {
  public readonly details: unknown

  constructor(name: string, details?: unknown) {
    super(name)
    this.name = name
    this.details = details

    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class RestException extends EnshouException {
  public readonly status: ContentfulStatusCode

  constructor(name: string, status: ContentfulStatusCode, details?: unknown) {
    super(name, details)
    this.status = status
  }

  toHTTP(): HTTPException {
    return new HTTPException(this.status, {
      res: new Response(
        JSON.stringify({
          name: this.name,
          code: this.status,
          details: this.details,
        }),
        {
          status: this.status,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    })
  }

  static BadRequest(details?: unknown): RestException {
    return new RestException('Bad Request', 400, details)
  }

  static NotFound(details?: unknown): RestException {
    return new RestException('Not Found', 404, details)
  }

  static UnprocessableEntity(details?: unknown): RestException {
    return new RestException('Unprocessable Entity', 422, details)
  }

  static TooManyRequests(details?: unknown): RestException {
    return new RestException('Too Many Requests', 429, details)
  }

  static InternalServerError(details?: unknown): RestException {
    return new RestException('Internal Server Error', 500, details)
  }
}
