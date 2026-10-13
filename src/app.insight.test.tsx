// @vitest-environment jsdom
// Tes alur M3: dashboard, sembunyikan nominal, anggaran, laporan.

import 'fake-indexeddb/auto';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import App from './App';
import { db } from './db';
import { setBudgetLimit } from './db/budgets';
import { completeOnboarding } from './db/onboarding';
import { saveTransaction } from './db/transactions';
import { localDate, toYearMonth } from './lib/date';

const today = localDate();
const month = toYearMonth(today);
const user = userEvent.setup();

beforeAll(async () => {
  globalThis.IntersectionObserver ??= class {
    observe() {}
    disconnect() {}
    unobserve() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };

  await completeOnboarding(
    db,
    { id: 'bca', name: 'BCA', group: 'asset', kind: 'bank', openingBalance: 5_000_000, openingDate: `${month}-01`, includeInAvailable: true },
    { today },
  );
  const tx = (id: string, type: 'income' | 'expense', amount: number, categoryId: string) =>
    saveTransaction(db, { id, type, date: today, amount, accountId: 'bca', categoryId }, { today });
  await tx('gaji', 'income', 10_000_000, 'cat-gaji');
  await tx('makan', 'expense', 900_000, 'cat-makan');
  await tx('bensin', 'expense', 300_000, 'cat-transportasi');
  await setBudgetLimit(db, { categoryId: 'cat-makan', month, amount: 1_000_000 });
});

afterAll(async () => {
  cleanup();
  await db.delete();
});

describe('Insight (M3)', () => {
  it('dashboard: Uang tersedia, ringkasan bulan, dan anggaran berisiko', async () => {
    render(<App />);
    const hero = await screen.findByRole('button', { name: /Uang tersedia/ });
    expect(hero.textContent).toContain('Rp13.800.000');

    const budget = screen.getByRole('heading', { name: /^Anggaran/ }).parentElement!;
    expect(within(budget).getByText('Makan & Minum')).toBeTruthy();
    expect(within(budget).getByText(/Hampir habis/)).toBeTruthy();
    expect(within(budget).getByRole('meter').getAttribute('aria-valuenow')).toBe('90');

    // Ikon sistem bersifat dekoratif (aria-hidden); hanya grafik berlabel yang boleh terbaca.
    const exposed = [...document.querySelectorAll('svg')].filter(
      (svg) => svg.getAttribute('aria-hidden') !== 'true' && svg.getAttribute('role') !== 'img',
    );
    expect(exposed).toHaveLength(0);
    expect(document.querySelectorAll('svg[aria-hidden="true"]').length).toBeGreaterThan(5);
  });

  it('rincian Uang tersedia menjelaskan asal angka', async () => {
    await user.click(screen.getByRole('button', { name: /Uang tersedia/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Rincian uang tersedia' });
    expect(within(dialog).getByText('BCA')).toBeTruthy();
    expect(within(dialog).getByText('Tidak ada tagihan yang menunggu.')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Tutup' }));
  });

  it('tombol mata menyembunyikan semua nominal, lalu menampilkannya lagi', async () => {
    await user.click(screen.getByRole('button', { name: 'Sembunyikan nominal' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Uang tersedia/ }).textContent).toContain('Rp •••••'));
    expect(document.body.textContent).not.toContain('Rp13.800.000');

    await user.click(screen.getByRole('button', { name: 'Tampilkan nominal' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Uang tersedia/ }).textContent).toContain('Rp13.800.000'));
  });

  it('laporan: per kategori dengan persen dan tabel tren', async () => {
    await user.click(screen.getAllByRole('link', { name: 'Laporan' })[0]);
    await screen.findByRole('heading', { name: 'Pengeluaran per kategori' });

    const makan = screen.getByRole('link', { name: /Makan & Minum/ });
    expect(makan.textContent).toContain('Rp900.000');
    expect(makan.textContent).toContain('75%');
    expect(makan.getAttribute('href')).toBe(`#/transaksi?bulan=${month}&kategori=cat-makan`);

    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(7); // header + 6 bulan
    expect(rows[1].textContent).toContain('Rp10.000.000');
    expect(rows[1].textContent).toContain('Rp1.200.000');
    expect(rows[1].textContent).toContain('Rp8.800.000');
    expect(screen.getByRole('button', { name: 'Bulan berikutnya' })).toHaveProperty('disabled', true);
  });

  it('anggaran: menambah batas kategori baru lewat dialog', async () => {
    await user.click(screen.getAllByRole('link', { name: 'Lainnya' })[0]);
    await user.click(await screen.findByRole('link', { name: /^Anggaran/ }));
    await user.click(await screen.findByRole('button', { name: 'Atur' }));

    const dialog = await screen.findByRole('dialog', { name: 'Atur anggaran' });
    await user.selectOptions(within(dialog).getByLabelText('Kategori'), 'cat-transportasi');
    await user.type(within(dialog).getByLabelText('Batas per bulan'), '200000');
    await user.click(within(dialog).getByRole('button', { name: 'Simpan' }));

    const row = await screen.findByRole('link', { name: /Transportasi/ });
    await waitFor(() => expect(row.textContent).toContain('Terlampaui'));
    expect(row.textContent).toContain('Rp100.000');
  });
});
