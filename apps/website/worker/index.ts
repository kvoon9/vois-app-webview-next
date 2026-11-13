const API_ORIGIN = 'https://api.voischat.cn'

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> }
}

/** A deploy replaces hashed chunks; a cached index would point at removed files. */
async function serveAsset(request: Request, env: Env): Promise<Response> {
  const response = await env.ASSETS.fetch(request)
  if (!response.headers.get('content-type')?.includes('text/html')) return response

  const headers = new Headers(response.headers)
  headers.set('Cache-Control', 'no-store')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

/**
 * The app calls `/v2` relatively and the API sends no CORS headers, so a static
 * host would break every data screen. Serve the build and proxy that prefix.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname !== '/v2' && !url.pathname.startsWith('/v2/')) {
      return serveAsset(request, env)
    }

    const target = new URL(`${url.pathname}${url.search}`, API_ORIGIN)
    return fetch(target, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'manual',
    })
  },
}
