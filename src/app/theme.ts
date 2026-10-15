// Tema tampilan: Otomatis (ikut HP) / Terang / Gelap. Disimpan per perangkat di localStorage
// (bukan di database) agar bisa dibaca sebelum aplikasi dimuat — lihat skrip di index.html.

import { useSyncExternalStore } from 'react';

export type ThemePref = 'system' | 'light' | 'dark';

const KEY = 'tema';
const listeners = new Set<() => void>();

export function getThemePref(): ThemePref {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

function systemPrefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyTheme(pref: ThemePref = getThemePref()): void {
  const dark = pref === 'dark' || (pref === 'system' && systemPrefersDark());
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0a1112' : '#f3f6f5');
}

export function setThemePref(pref: ThemePref): void {
  try {
    if (pref === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    // Penyimpanan diblokir: tema tetap berlaku sampai aplikasi ditutup.
  }
  applyTheme(pref);
  listeners.forEach((listener) => listener());
}

/** Ikuti perubahan mode gelap HP selama pilihan "Otomatis". */
export function watchSystemTheme(): void {
  if (typeof matchMedia !== 'function') return;
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getThemePref() === 'system') applyTheme('system');
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useThemePref(): ThemePref {
  return useSyncExternalStore(subscribe, getThemePref, () => 'system');
}
