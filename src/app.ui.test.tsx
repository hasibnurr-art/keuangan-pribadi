// @vitest-environment jsdom
// Tes alur nyata di UI: onboarding → catat → undo → transfer dengan biaya → hapus.

import 'fake-indexeddb/auto';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import App from './App';
import { db } from './db';

beforeAll(() => {
  // jsdom belum lengkap untuk API berikut.
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
});

afterAll(async () => {
  cleanup();
  await db.delete();
});

const user = userEvent.setup();

async function expectTotalCash(text: string) {
  const card = await screen.findByText('Total kas');
  await waitFor(() => expect(card.nextElementSibling?.textContent).toBe(text));
}

describe('Alur utama aplikasi', () => {
  it('onboarding membuat akun pertama lalu menampilkan beranda', async () => {
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Mulai baru' }));
    await user.type(screen.getByLabelText('Nama akun'), 'BCA');
    await user.type(screen.getByLabelText('Saldo saat ini'), '1500000');
    expect(screen.getByLabelText('Saldo saat ini')).toHaveProperty('value', '1.500.000');
    await user.click(screen.getByRole('button', { name: 'Lanjut' }));
    await user.click(await screen.findByRole('button', { name: 'Selesai, mulai mencatat' }));

    expect(await screen.findByRole('heading', { name: 'Beranda' })).toBeTruthy();
    await expectTotalCash('Rp1.500.000');
  });

  it('mencatat pengeluaran dengan nominal → kategori → simpan, lalu undo', async () => {
    await user.click(screen.getAllByRole('link', { name: /Tambah transaksi/ })[0]);
    await user.type(await screen.findByLabelText('Nominal'), '50');
    await user.click(screen.getByRole('button', { name: '000' }));
    await user.click(screen.getByRole('button', { name: /Makan & Minum/ }));
    await user.click(screen.getByRole('button', { name: 'Simpan' }));

    await expectTotalCash('Rp1.450.000');
    const recent = screen.getByRole('heading', { name: /Transaksi terbaru/ }).parentElement!;
    expect(within(recent).getByText('Makan & Minum')).toBeTruthy();

    await user.click(await screen.findByRole('button', { name: 'Batalkan' }));
    await expectTotalCash('Rp1.500.000');
  });

  it('validasi: simpan tanpa nominal dan kategori menampilkan pesan per field', async () => {
    await user.click(screen.getAllByRole('link', { name: /Tambah transaksi/ })[0]);
    await user.click(await screen.findByRole('button', { name: 'Simpan' }));
    expect(await screen.findByText(/Nominal harus bilangan bulat/)).toBeTruthy();
    expect(screen.getByText('Pilih kategori.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Kembali' }));
  });

  it('menambah akun GoPay lalu transfer dengan biaya admin', async () => {
    await user.click((await screen.findAllByRole('link', { name: 'Lainnya' }))[0]);
    await user.click(await screen.findByRole('link', { name: /^Akun/ }));
    await user.click(await screen.findByRole('link', { name: 'Tambah' }));
    await user.selectOptions(await screen.findByLabelText('Jenis'), 'ewallet');
    await user.type(screen.getByLabelText('Nama akun'), 'GoPay');
    await user.click(screen.getByRole('button', { name: 'Simpan akun' }));
    expect(await screen.findByRole('heading', { name: 'GoPay' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Kembali' }));
    await user.click(screen.getAllByRole('link', { name: /Tambah transaksi/ })[0]);
    await user.click(await screen.findByRole('radio', { name: 'Transfer' }));
    await user.type(screen.getByLabelText('Nominal'), '1000000');
    const toAccount = screen.getByLabelText('Ke akun');
    await user.selectOptions(toAccount, within(toAccount).getByRole('option', { name: 'GoPay' }));
    await user.click(screen.getByRole('button', { name: /Biaya tambahan/ }));
    await user.type(screen.getByLabelText('Nominal biaya'), '2500');
    await user.click(screen.getByRole('button', { name: 'Simpan' }));

    // Kembali ke halaman akun: BCA − 1.002.500, GoPay + 1.000.000.
    const bca = await screen.findByRole('link', { name: /BCA/ });
    await waitFor(() => expect(bca.textContent).toContain('Rp497.500'));
    expect(screen.getByRole('link', { name: /GoPay/ }).textContent).toContain('Rp1.000.000');
    await expectTotalCash('Rp1.497.500');
  });

  it('menghapus transfer ikut menghapus biayanya', async () => {
    await user.click(screen.getByRole('link', { name: /BCA/ }));
    const list = await screen.findByRole('heading', { name: /^Transaksi/ });
    const rows = within(list.parentElement!).getAllByRole('link');
    expect(rows).toHaveLength(2); // transfer + biaya
    await user.click(rows.find((r) => r.textContent?.includes('Bunga & Biaya Admin'))!);
    // Biaya membuka transfer induknya.
    expect(await screen.findByRole('radio', { name: 'Transfer', checked: true })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Hapus transaksi' }));

    await screen.findByText('Transaksi dihapus');
    expect(await db.transactions.count()).toBe(0);
  });
});
