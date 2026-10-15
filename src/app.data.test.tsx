// @vitest-environment jsdom
// Tes alur M5: pengingat backup → backup → pulihkan → hapus semua → pulihkan dari onboarding.

import 'fake-indexeddb/auto';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import App from './App';
import { db } from './db';
import { completeOnboarding } from './db/onboarding';
import { saveTransaction } from './db/transactions';
import { localDate, toYearMonth } from './lib/date';

const today = localDate();
const user = userEvent.setup();
/** File terakhir yang "diunduh" aplikasi. */
let downloaded: File | null = null;

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
  URL.createObjectURL = (blob: Blob) => {
    downloaded = blob as File;
    return 'blob:test';
  };
  URL.revokeObjectURL = () => {};
  HTMLAnchorElement.prototype.click = function () {};

  await completeOnboarding(
    db,
    { id: 'bca', name: 'BCA', group: 'asset', kind: 'bank', openingBalance: 2_000_000, openingDate: `${toYearMonth(today)}-01`, includeInAvailable: true },
    { today },
  );
  await saveTransaction(db, { id: 'makan', type: 'expense', date: today, amount: 50_000, accountId: 'bca', categoryId: 'cat-makan' }, { today });
});

afterAll(async () => {
  cleanup();
  await db.delete();
});

const hero = () => screen.getByRole('button', { name: /Uang tersedia/ });

describe('Backup & data (M5)', () => {
  it('Beranda tidak menampilkan pengingat backup (backup dilakukan mandiri)', async () => {
    render(<App />);
    await screen.findByRole('button', { name: /Uang tersedia/ });
    expect(screen.queryByText(/belum pernah backup/)).toBeNull();
  });

  it('Backup sekarang menghasilkan file JSON lengkap dan mencatat waktu backup', async () => {
    await user.click(screen.getAllByRole('link', { name: 'Lainnya' })[0]);
    await user.click(await screen.findByRole('link', { name: /^Backup & Data/ }));
    expect(await screen.findByText('Anda belum pernah membuat backup.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Backup sekarang' }));
    await screen.findByText(/File backup diunduh/);
    expect(downloaded?.name).toMatch(/^keuangan-backup-\d{4}-\d{2}-\d{2}-\d{4}\.json$/);
    const content = JSON.parse(await downloaded!.text());
    expect(content).toMatchObject({ app: 'keuangan-pribadi', counts: { accounts: 1, transactions: 1 } });
    expect(await screen.findByText(/Backup terakhir hari ini/)).toBeTruthy();
  });

  it('Pulihkan: preview, peringatan penggantian, lalu data kembali seperti saat backup', async () => {
    const backupFile = downloaded!;
    await saveTransaction(db, { id: 'baru', type: 'expense', date: today, amount: 300_000, accountId: 'bca', categoryId: 'cat-makan' }, { today });
    expect(await db.transactions.count()).toBe(2);

    await user.upload(screen.getByLabelText('File backup'), backupFile);
    const dialog = await screen.findByRole('dialog', { name: 'Pulihkan data?' });
    expect(within(dialog).getByText(/akan DIGANTI/)).toBeTruthy();
    expect(within(dialog).getByText('BCA')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Pulihkan' }));

    await screen.findByText('Data berhasil dipulihkan');
    expect(await db.transactions.count()).toBe(1);
    await waitFor(() => expect(hero().textContent).toContain('Rp1.950.000'));
  });

  it('file yang bukan backup ditolak dengan pesan jelas', async () => {
    await user.click(screen.getAllByRole('link', { name: 'Lainnya' })[0]);
    await user.click(await screen.findByRole('link', { name: /^Backup & Data/ }));
    await user.upload(screen.getByLabelText('File backup'), new File(['halo'], 'catatan.json', { type: 'application/json' }));
    expect(await screen.findByText(/bukan file backup yang valid/)).toBeTruthy();
  });

  it('Hapus semua data butuh ketik HAPUS lalu kembali ke onboarding', async () => {
    await user.click(screen.getByRole('button', { name: 'Hapus semua data…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Hapus semua data?' });
    const confirm = within(dialog).getByRole('button', { name: 'Hapus permanen' });
    expect(confirm).toHaveProperty('disabled', true);
    await user.type(within(dialog).getByLabelText(/Ketik "HAPUS"/), 'hapus');
    await user.click(confirm);

    expect(await screen.findByRole('button', { name: 'Mulai baru' })).toBeTruthy();
    expect(await db.accounts.count()).toBe(0);
  });

  it('onboarding: pulihkan dari file backup langsung membuka aplikasi', async () => {
    await user.upload(screen.getByLabelText('File backup'), downloaded!);
    const dialog = await screen.findByRole('dialog', { name: 'Pulihkan data?' });
    expect(within(dialog).queryByText(/akan DIGANTI/)).toBeNull(); // perangkat masih kosong
    await user.click(within(dialog).getByRole('button', { name: 'Pulihkan' }));

    expect(await screen.findByRole('heading', { name: 'Beranda' })).toBeTruthy();
    await waitFor(() => expect(hero().textContent).toContain('Rp1.950.000'));
  });

  it('Pengaturan: nama panggilan untuk sapaan, backup mandiri, dan versi aplikasi', async () => {
    await user.click(screen.getAllByRole('link', { name: 'Lainnya' })[0]);
    await user.click(await screen.findByRole('link', { name: /^Pengaturan/ }));
    await user.type(await screen.findByLabelText('Nama panggilan'), 'Hasib');
    await user.tab();
    await waitFor(async () => expect((await db.settings.get('userName'))?.value).toBe('Hasib'));
    expect(screen.getByRole('button', { name: 'Backup sekarang' })).toBeTruthy();
    expect(screen.getByText(/Backup terakhir hari ini/)).toBeTruthy();
    expect(screen.getByText(/versi \d+\.\d+\.\d+/)).toBeTruthy();

    await user.click(screen.getAllByRole('link', { name: 'Beranda' })[0]);
    expect(await screen.findByText('Hasib')).toBeTruthy();
  });
});
