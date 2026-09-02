import { defineNitroConfig } from 'nitropack'

export default defineNitroConfig({
  compatibilityDate: '2024-04-03',
  devServer: {},
  routeRules: {
    '/v2/**': {
      cors: true,
    },
  },
})
