export function parseResponseSchema(jsonSchema: any): Record<string, any> {
  const properties = jsonSchema?.properties ?? {}

  if (!('json' in properties) && !('header' in properties) && !('cookie' in properties)) {
    return {
      content: {
        'application/json': { schema: jsonSchema },
      },
    }
  }

  const response: Record<string, any> = {}

  if (properties.json) {
    response.content = {
      'application/json': { schema: properties.json },
    }
  }

  if ('header' in properties) {
    response.headers = {}
  }

  for (const [headerName, headerSchema] of Object.entries(properties.header?.properties ?? {})) {
    response.headers[headerName] = { schema: headerSchema }
  }

  if (properties.cookie) {
    response.headers ??= {}
    response.headers[`Set-Cookie`] = {
      schema: { type: 'string' },
    }
  }

  return response
}
