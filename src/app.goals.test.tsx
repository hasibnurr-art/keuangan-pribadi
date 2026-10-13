// @vitest-environment jsdom
// Tes alur Target tabungan: Dana Darurat dari template → Beranda & Uang tersedia → setoran → tonggak → simulasi.

import 'fake-indexeddb/auto';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import App from './App';
import { db } from './db';
import { completeOnboarding } from './db/onboarding';
import { saveTransaction } from './db/transactions';
import { completionMonth, requiredPerMonth } from './domain/goals';
import { addMonths, localDate, toYearMonth } from './lib/date';
import { formatMonth } from './lib/format';
import { formatRupiah } from './lib/money';

const today = localDate();
const month = toYearMonth(today);
const user = userEvent.setup();
const needed = requiredPerMonth(24_000_000, addMonths(month, 12), today);

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
    { id: 'bca', name: 'BCA', group: 'asset', kind: 'bank', openingBalance: 20_000_000, openingDate: `${addMonths(month, -4)}-01`, includeInAvailable: true },
    { today },
  );
  // 3 bulan penuh terakhir: pengeluaran Rp4 jt/bulan → saran dana darurat 6 × 4 jt = 24 jt.
  for (const offset of [-1, -2, -3]) {
    await saveTransaction(
      db,
      { id: `m${offset}`, type: 'expense', date: `${addMonths(month, offset)}-10`, amount: 4_000_000, accountId: 'bca', categoryId: 'cat-makan' },
      { today },
    );
  }
});

afterAll(async () => {
  cleanup();
  await db.delete();
});

describe('Target tabungan', () => {
  it('Dana Darurat dari template: saran nominal dan setoran per bulan terisi otomatis', async () => {
    render(<App />);
    await user.click((await screen.findAllByRole('link', { name: 'Lainnya' }))[0]);
    await user.click(await screen.findByRole('link', { name: /^Target tabungan/ }));
    await user.click(await screen.findByRole('link', { name: /Mulai dengan Dana Darurat/ }));

    expect((await screen.findByLabelText('Nama target') as HTMLInputElement).value).toBe('Dana Darurat');
    expect(screen.getByText(/Rata-rata pengeluaran Anda/).textContent).toContain('Rp4.000.000');
    expect((screen.getByLabelText('Jumlah target') as HTMLInputElement).value).toBe('24.000.000');
    expect((screen.getByLabelText('Nominal per bulan') as HTMLInputElement).value).toBe(formatRupiah(needed).slice(2));

    await user.click(screen.getByRole('button', { name: 'Buat target' }));
    // Tunggu halaman detail (judul form template juga 'Dana Darurat').
    expect(await screen.findByText(/Terkumpul ·/, undefined, { timeout: 3000 })).toBeTruthy();
    expect(screen.getByText(/Sesuai jadwal/)).toBeTruthy();
    expect(screen.getByText(/Setoran rutin/).textContent).toContain(formatRupiah(needed));
  });

  it('Beranda: kartu target tampil dan setoran rutin mengurangi Uang tersedia', async () => {
    await user.click(screen.getAllByRole('link', { name: 'Beranda' })[0]);
    const card = await screen.findByRole('region', { name: 'Target tabungan' });
    expect(within(card).getByText('Dana Darurat')).toBeTruthy();
    // Kas BCA 20 jt − 12 jt pengeluaran = 8 jt; dikurangi setoran bulan ini.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Uang tersedia/ }).textContent).toContain(formatRupiah(8_000_000 - needed)),
    );
  });

  it('Tambah setoran: transfer ke akun tabungan menaikkan progres dan memunculkan tonggak 25%', async () => {
    await user.click(within(screen.getByRole('region', { name: 'Target tabungan' })).getByRole('link', { name: /Dana Darurat/ }));
    await user.click(await screen.findByRole('link', { name: 'Tambah setoran' }));

    expect(await screen.findByRole('radio', { name: 'Transfer', checked: true })).toBeTruthy();
    expect((screen.getByLabelText('Ke akun') as HTMLSelectElement).selectedOptions[0].textContent).toBe('Tabungan Dana Darurat');
    await user.type(screen.getByLabelText('Nominal'), '6000000');
    await user.click(screen.getByRole('button', { name: 'Simpan' }));

    await screen.findByText(/Terkumpul ·/, undefined, { timeout: 3000 });
    await waitFor(() => expect(screen.getByText(/Terkumpul · 25%/)).toBeTruthy());
    expect(screen.getByText(/Seperempat jalan/)).toBeTruthy();
  });

  it('Simulasi: menabung Rp3 jt/bulan → bulan tercapai', async () => {
    await user.type(screen.getByLabelText('Kalau saya menabung per bulan'), '3000000');
    const expected = completionMonth(18_000_000, 3_000_000, today)!;
    expect(await screen.findByText(formatMonth(expected))).toBeTruthy();

    await user.click(screen.getByRole('radio', { name: 'Tercapai bulan' }));
    expect(screen.getByText(/Perlu menabung/)).toBeTruthy();
  });
});
