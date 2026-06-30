import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: 'autoUpdate',        // SW tự cập nhật khi deploy version mới
      injectRegister: 'auto',

      // Workbox config — cache strategy
      workbox: {
        // Cache shell files (JS/CSS/HTML) — stale-while-revalidate
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],

        // Runtime caching rules
        runtimeCaching: [
          {
            // Supabase API — network first, fallback cache
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 5 * 60, // 5 phút
              },
            },
          },
          {
            // Google Fonts
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 năm
              },
            },
          },
          {
            // Ảnh sản phẩm từ Supabase Storage
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'product-images',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 1 tuần
              },
            },
          },
        ],

        // Tránh cache lỗi opaque response
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
      },

      // Manifest — metadata của app khi cài lên iOS/Android
      manifest: {
        name:             'ANC - CFAM',
        short_name:       'CFAM',
        description:      'Cash Flow & Asset Management — Business OS',
        theme_color:      '#080b10',
        background_color: '#080b10',
        display:          'standalone',       // Ẩn thanh địa chỉ, giống native
        display_override: ['standalone', 'minimal-ui'],
        orientation:      'portrait',
        start_url:        '/',
        scope:            '/',
        lang:             'vi',
        categories:       ['finance', 'business', 'productivity'],

        icons: [
          {
            src:     '/icon-192.png',
            sizes:   '192x192',
            type:    'image/png',
            purpose: 'any',
          },
          {
            src:     '/icon-512.png',
            sizes:   '512x512',
            type:    'image/png',
            purpose: 'any',
          },
          {
            src:     '/icon-maskable.png',
            sizes:   '512x512',
            type:    'image/png',
            purpose: 'maskable',            // Android adaptive icon
          },
          {
            src:     '/apple-touch-icon.png',
            sizes:   '180x180',
            type:    'image/png',
          },
        ],

        shortcuts: [
          {
            name:      'Bán Hàng (POS)',
            short_name:'POS',
            url:       '/?tab=pos',
            icons:     [{ src: '/icon-192.png', sizes: '192x192' }],
          },
          {
            name:      'Đơn Hàng',
            short_name:'Đơn',
            url:       '/?tab=orders',
            icons:     [{ src: '/icon-192.png', sizes: '192x192' }],
          },
        ],
      },

      // Dev mode — service worker hoạt động ngay khi dev
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],

  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'supabase':     ['@supabase/supabase-js'],
          'chart':        ['chart.js', 'react-chartjs-2'],
          'xlsx':         ['xlsx'],
        },
      },
    },
  },

  server: {
    host: '0.0.0.0',
    port: 5173,
  },
})
