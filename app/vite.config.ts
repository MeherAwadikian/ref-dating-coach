import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Base is '/' so the same build serves correctly on Cloudflare Pages (root domain)
// and inside the Capacitor iOS WebView (which loads from the bundle root).
export default defineConfig({
  base: '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png', 'favicon.svg'],
      manifest: {
        name: 'Wingman: Dating Coach',
        short_name: 'Wingman',
        description: 'On-device dating-conversation copilot: reply coaching, icebreakers, profile review, practice.',
        theme_color: '#3b82f6',
        background_color: '#0b1220',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        // Android: share selected text / a link straight into Wingman Coach.
        // (iOS Safari ignores share_target; the in-app "Paste a screenshot" OCR
        // covers image input everywhere.)
        share_target: {
          action: '/',
          method: 'GET',
          params: { title: 'title', text: 'text', url: 'url' },
        },
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // The wink-nlp model + tesseract OCR core are large, lazy-loaded chunks —
        // keep them out of the install-time precache so first load stays light.
        globIgnores: ['**/model-*.js', '**/native-*.js'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
