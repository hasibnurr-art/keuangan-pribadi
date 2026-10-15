import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

// base relatif + HashRouter: aplikasi bisa di-host di subpath GitHub Pages tanpa konfigurasi server.
export default defineConfig({
  base: './',
  // Ukuran gzip ±160 KB, di bawah target PRD 300 KB; batas mentah dinaikkan agar peringatan relevan.
  build: { chunkSizeWarningLimit: 700 },
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // "prompt": versi baru tidak memuat ulang otomatis saat pengguna sedang mengisi form (PRD §6.3).
      registerType: 'prompt',
      // Ikon sudah tercakup globPatterns; hindari entri precache ganda.
      includeManifestIcons: false,
      manifest: {
        name: 'Dompet Waras',
        short_name: 'Dompet Waras',
        description: 'Tetap waras di tengah gempuran ekonomi. Catat keuangan pribadi; data hanya tersimpan di perangkat Anda.',
        lang: 'id',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f3f6f5',
        theme_color: '#0b6a60',
        // Nama file ikon memuat nama logo: jika logo diganti, ganti juga nama filenya agar
        // Android memperbarui ikon & layar pembuka aplikasi yang sudah terpasang.
        icons: [
          { src: 'icons/dompet-waras-64.png', sizes: '64x64', type: 'image/png' },
          { src: 'icons/dompet-waras-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/dompet-waras-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/dompet-waras-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache seluruh aset: aplikasi berjalan 100% offline setelah kunjungan pertama.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
