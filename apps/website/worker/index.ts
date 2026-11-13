const API_ORIGIN = 'https://api.voischat.cn'

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> }
}

/**
 * The app calls `/v2` relatively and the API sends no CORS headers, so a static
 * host would break every data screen. Serve the build and proxy that prefix.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/v2/')) return env.ASSETS.fetch(request)

    const target = new URL(`${url.pathname}${url.search}`, API_ORIGIN)
    return fetch(target, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'manual',
    })
  },
}
