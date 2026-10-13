// @vitest-environment jsdom
// Regresi: menambah cicilan (akun pinjaman + tagihan dengan bulan berakhir) lalu kembali ke Beranda.

import 'fake-indexeddb/auto';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import App from './App';
import { db } from './db';
import { completeOnboarding } from './db/onboarding';
import { addMonths, localDate, toYearMonth } from './lib/date';

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
});

afterAll(async () => {
  cleanup();
  await db.delete();
});

describe('Cicilan', () => {
  it('akun pinjaman + tagihan cicilan, lalu Beranda, Tagihan, Laporan tetap tampil', async () => {
    render(<App />);
    await user.click((await screen.findAllByRole('link', { name: 'Lainnya' }))[0]);
    await user.click(await screen.findByRole('link', { name: /^Akun/ }));
    await user.click(await screen.findByRole('link', { name: 'Tambah' }));
    await user.click(await screen.findByRole('radio', { name: 'Utang' }));
    await user.selectOptions(screen.getByLabelText('Jenis'), 'loan');
    await user.type(screen.getByLabelText('Nama akun'), 'Cicilan Motor');
    await user.type(screen.getByLabelText('Jumlah terutang saat ini'), '8000000');
    await user.click(screen.getByRole('button', { name: 'Simpan akun' }));

    await user.click(await screen.findByRole('link', { name: 'Buat tagihan bulanan' }));
    await user.type(await screen.findByLabelText('Nominal'), '1000000');
    await user.selectOptions(screen.getByLabelText('Jatuh tempo tiap tanggal'), '10');
    const end = screen.getByLabelText('Berakhir (opsional)');
    await user.type(end, addMonths(month, 7));
    await user.click(screen.getByRole('button', { name: 'Simpan tagihan' }));

    await user.click((await screen.findAllByRole('link', { name: 'Beranda' }))[0]);
    expect(await screen.findByRole('button', { name: /Uang tersedia/ }, { timeout: 3000 })).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Tagihan' })).getByText('Bayar Cicilan Motor')).toBeTruthy();

    await user.click(screen.getAllByRole('link', { name: 'Laporan' })[0]);
    expect(await screen.findByRole('heading', { name: 'Laporan' })).toBeTruthy();
  }, 30_000);
});
