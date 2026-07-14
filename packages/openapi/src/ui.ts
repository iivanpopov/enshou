import type { Context } from 'hono'

import { html } from 'hono/html'

export function ui(options: {
  path: string
  openapiPath: string
  title?: string
  cdn?: string
  theme?: string
}) {
  const title = options.title ?? 'API Reference'
  const cdn = options.cdn ?? 'https://cdn.jsdelivr.net/npm/@scalar/api-reference'
  const theme = options.theme ?? 'default'

  return (c: Context): Response | Promise<Response> =>
    c.html(
      html`<!doctype html>
        <html>
          <head>
            <title>${title}</title>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
          </head>
          <body>
            <script
              id="api-reference"
              data-url="${options.openapiPath}"
              data-configuration="${JSON.stringify({ theme })}"
            ></script>
            <script src="${cdn}"></script>
          </body>
        </html>`,
    )
}
