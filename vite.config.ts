/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// mode "artifact": versión de una sola página para publicar como Artifact (sin service worker).
// BASE_PATH permite publicar en una subcarpeta (GitHub Pages: /Caserita/).
const base = (mode: string) => process.env.BASE_PATH ?? (mode === 'artifact' ? './' : '/');

export default defineConfig(({ mode }) => ({
  base: base(mode),
  build: mode === 'artifact' ? { outDir: 'dist-artifact', assetsInlineLimit: 100000000 } : {},
  plugins: [
    react(),
    VitePWA({
      disable: mode === 'artifact',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Caserita',
        short_name: 'Caserita',
        description: 'Ventas, fiados e inventario para tu bodega',
        lang: 'es',
        theme_color: '#1B7F45',
        background_color: '#FFF8EC',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base(mode),
        scope: base(mode),
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
    }),
  ],
  test: { environment: 'node' },
}));
