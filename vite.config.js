import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'P·Share',
        short_name: 'P·Share',
        description: 'Personal music streaming',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        start_url: '/pshare/app/',
        scope: '/pshare/app/',
        icons: [
          {
            src: '/pshare/app/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable any',
          },
          {
            src: '/pshare/app/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable any',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        navigateFallback: '/pshare/app/index.html',
        runtimeCaching: [
          {
            urlPattern: /\/pshare\/stream\//,
            handler: 'NetworkOnly',
          },
          {
            // Admin endpoints are all live, mutable state (upload queue polling,
            // logs, search) for a single admin user — never serve them stale.
            urlPattern: /\/pshare\/api\/admin\//,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /\/pshare\/api\//,
            handler: 'StaleWhileRevalidate',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      // jsmediatags package.json points browser field to dist/jsmediatags.js which doesn't
      // exist — only the .min.js is shipped. Point directly to the file that exists.
      'jsmediatags': 'jsmediatags/dist/jsmediatags.min.js',
    },
  },
  base: process.env.NODE_ENV === 'production' ? '/pshare/app/' : '/',
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3939',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    },
    historyApiFallback: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.js'],
    globals: true,
    // Default excludes don't cover nested worktree checkouts (e.g.
    // .claude/worktrees/<name>/), which live inside this repo's directory
    // tree and have their own node_modules — without this, vitest
    // double-discovers every test file and loads two conflicting copies
    // of React.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
      '**/.worktrees/**',
      '**/worktrees/**',
      '**/.claude/worktrees/**',
    ],
  },
})
