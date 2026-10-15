// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, getThemePref, setThemePref } from './theme';

function mockSystemDark(dark: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: dark && query.includes('dark'), addEventListener() {} }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('Tema tampilan', () => {
  it('Otomatis mengikuti mode gelap HP', () => {
    mockSystemDark(true);
    applyTheme();
    expect(getThemePref()).toBe('system');
    expect(document.documentElement.dataset.theme).toBe('dark');

    mockSystemDark(false);
    applyTheme();
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('pilihan manual disimpan dan mengalahkan pengaturan HP', () => {
    mockSystemDark(true);
    setThemePref('light');
    expect(localStorage.getItem('tema')).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');

    setThemePref('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');

    setThemePref('system');
    expect(localStorage.getItem('tema')).toBeNull();
    expect(getThemePref()).toBe('system');
  });
});
