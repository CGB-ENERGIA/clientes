/* eslint-env node */
const { configure } = require('quasar/wrappers')

module.exports = configure(function (/* ctx */) {
  return {
    boot: ['pinia', 'supabase'],

    css: ['app.scss'],

    extras: ['material-icons'],

    build: {
      vueRouterMode: 'hash'
    },

    devServer: {
      open: true
    },

    framework: {
      config: {
        notify: { position: 'top-right' }
      },
      lang: 'pt-BR',
      plugins: ['Notify', 'Dialog', 'Dark']
    },

    animations: [],

    pwa: {
      workboxPluginMode: 'GenerateSW',
      workboxOptions: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
            handler: 'CacheFirst',
            options: { cacheName: 'images', expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 } }
          }
        ]
      },
      manifest: {
        name: 'CGB Campo',
        short_name: 'CGB Campo',
        description: 'Registro de postes em campo · CGB Energia',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#060b14',
        theme_color: '#1565c0',
        start_url: '/#/campo',
        icons: [
          { src: 'icons/icon-128x128.png', sizes: '128x128', type: 'image/png' },
          { src: 'icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-256x256.png', sizes: '256x256', type: 'image/png' },
          { src: 'icons/icon-384x384.png', sizes: '384x384', type: 'image/png' },
          { src: 'icons/icon-512x512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    }
  }
})
