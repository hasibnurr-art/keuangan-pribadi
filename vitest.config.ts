import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import pkg from './package.json' with { type: 'json' };

// Semua tes berjalan di zona waktu WIB agar bug pergeseran tanggal UTC terdeteksi.
process.env.TZ = 'Asia/Jakarta';

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: {
    alias: {
      'virtual:pwa-register/react': fileURLToPath(new URL('./src/test/pwaStub.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      include: ['src/domain/**', 'src/lib/**', 'src/db/**', 'src/backup/**'],
      exclude: ['src/**/*.test.ts', 'src/test/**'],
    },
  },
});
