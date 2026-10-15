import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Menghasilkan ikon PWA dari public/icon.svg: `npx pwa-assets-generator`, lalu pindahkan PNG-nya ke
// public/icons/ dengan nama baru (lihat manifest di vite.config.ts) agar HP memperbarui ikon terpasang.
// Ikon maskable (Android) dan apple-touch (iPhone) dibuat dari public/icon-maskable.svg (latar penuh,
// tanpa sudut bulat) dengan sharp: skala 0.74 untuk maskable 512 px, 0.86 untuk apple 180 px.
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#0b5f56' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#0b5f56' } },
  },
  images: ['public/icon.svg'],
})
