import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Menghasilkan ikon PWA dari public/icon.svg: `npx pwa-assets-generator`.
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#173b66' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#173b66' } },
  },
  images: ['public/icon.svg'],
})
