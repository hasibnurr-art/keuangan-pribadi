// @vitest-environment jsdom
// Tes alur M4: buat tagihan → tampil di Beranda & Uang tersedia → Bayar → Lewati → saran dari akun utang.

import 'fake-indexeddb/auto';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import App from './App';
import { db } from './db';
import { saveAccount } from './db/accounts';
import { completeOnboarding } from './db/onboarding';
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
  const base = { group: 'asset' as const, kind: 'bank' as const, openingDate: `${month}-01`, includeInAvailable: true };
  await completeOnboarding(db, { ...base, id: 'bca', name: 'BCA', openingBalance: 5_000_000 }, { today });
  await saveAccount(db, { ...base, id: 'kartu', name: 'Kartu BCA', group: 'liability', kind: 'credit_card', openingBalance: 0 }, { today });
});

afterAll(async () => {
  cleanup();
  await db.delete();
});

const hero = () => screen.getByRole('button', { name: /Uang tersedia/ });

describe('Tagihan rutin (M4)', () => {
  it('membuat tagihan listrik jatuh tempo hari ini', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Beranda' });
    expect(hero().textContent).toContain('Rp5.000.000');

    await user.click(screen.getAllByRole('link', { name: 'Lainnya' })[0]);
    await user.click(await screen.findByRole('link', { name: /^Tagihan/ }));
    await user.click(await screen.findByRole('link', { name: 'Tambah tagihan' }));

    await user.type(await screen.findByLabelText('Nama tagihan'), 'Listrik');
    await user.type(screen.getByLabelText('Nominal'), '400000');
    await user.click(screen.getByLabelText(/Nominal bisa berubah/));
    await user.selectOptions(screen.getByLabelText('Jatuh tempo tiap tanggal'), String(Number(today.slice(8, 10))));
    expect((screen.getByLabelText('Kategori') as HTMLSelectElement).value).toBe('cat-tagihan');
    await user.click(screen.getByRole('button', { name: 'Simpan tagihan' }));

    const thisMonth = await screen.findByRole('region', { name: /^Bulan ini/ });
    expect(within(thisMonth).getByText('Listrik')).toBeTruthy();
    expect(within(thisMonth).getByText('Akan datang')).toBeTruthy();
    expect(within(thisMonth).getByText(/≈ Rp400.000/)).toBeTruthy();
  });

  it('Beranda: tagihan tampil dan Uang tersedia dikurangi tagihan', async () => {
    await user.click(screen.getAllByRole('link', { name: 'Beranda' })[0]);
    await waitFor(() => expect(hero().textContent).toContain('Rp4.600.000'));
    expect(hero().textContent).toContain('Tagihan bulan ini−Rp400.000');
    const card = screen.getByRole('region', { name: 'Tagihan' });
    expect(within(card).getByText('Listrik')).toBeTruthy();
  });

  it('Bayar membuka form yang sudah terisi; nominal bisa disesuaikan', async () => {
    const card = screen.getByRole('region', { name: 'Tagihan' });
    await user.click(within(card).getByRole('link', { name: 'Bayar' }));

    expect(await screen.findByRole('heading', { name: 'Bayar tagihan' })).toBeTruthy();
    expect(screen.getByText(/Membayar tagihan Listrik/)).toBeTruthy();
    const amount = screen.getByLabelText('Nominal') as HTMLInputElement;
    expect(amount.value).toBe('400.000');
    expect(screen.getByRole('button', { name: /Tagihan & Utilitas/, pressed: true })).toBeTruthy();

    await user.clear(amount);
    await user.type(amount, '412500');
    await user.click(screen.getByRole('button', { name: 'Simpan' }));

    await screen.findByText('Tagihan dibayar');
    // Kas turun 412.500; tagihan bulan ini sudah dibayar sehingga tidak dikurangkan lagi.
    await waitFor(() => expect(hero().textContent).toContain('Rp4.587.500'));
    expect(within(screen.getByRole('region', { name: 'Tagihan' })).queryByText('Listrik')).toBeNull();
  });

  it('halaman Tagihan: status Dibayar dan lewati bulan depan (bisa dibatalkan)', async () => {
    await user.click(within(screen.getByRole('region', { name: 'Tagihan' })).getByRole('link', { name: 'Lihat semua' }));
    const thisMonth = await screen.findByRole('region', { name: /^Bulan ini/ });
    expect(within(thisMonth).getByText('Dibayar')).toBeTruthy();
    expect(within(thisMonth).getByText('Rp412.500')).toBeTruthy();

    const next = screen.getByRole('region', { name: /^Bulan depan/ });
    await user.click(within(next).getByRole('button', { name: 'Lewati bulan ini' }));
    await waitFor(() => expect(within(next).getByText('Dilewati')).toBeTruthy());
    await user.click(await screen.findByRole('button', { name: 'Batalkan' }));
    await waitFor(() => expect(within(next).getByText('Akan datang')).toBeTruthy());
  });

  it('akun kartu kredit menyarankan tagihan bulanan yang terisi otomatis', async () => {
    await user.click(screen.getAllByRole('link', { name: 'Lainnya' })[0]);
    await user.click(await screen.findByRole('link', { name: /^Akun/ }));
    await user.click(await screen.findByRole('link', { name: /Kartu BCA/ }));
    await user.click(await screen.findByRole('link', { name: 'Buat tagihan bulanan' }));

    expect((await screen.findByLabelText('Nama tagihan') as HTMLInputElement).value).toBe('Bayar Kartu BCA');
    expect(screen.getByRole('radio', { name: 'Bayar utang', checked: true })).toBeTruthy();
    expect((screen.getByLabelText('Ke akun utang') as HTMLSelectElement).value).toBe('kartu');
    expect((screen.getByLabelText(/Nominal bisa berubah/) as HTMLInputElement).checked).toBe(true);
  });
});
