import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useData } from '../../app/data';
import { planAdjustment } from '../../domain/adjustment';
import { ACCOUNT_KIND_LABEL } from '../../domain/defaults';
import { hasTransactions } from '../../domain/entityRules';
import { sortNewestFirst } from '../../domain/history';
import type { Account, Rupiah } from '../../domain/types';
import { db } from '../../db';
import { adjustBalance, deleteAccount, setAccountArchived } from '../../db/accounts';
import { deleteTransaction } from '../../db/transactions';
import { formatDisplayDate } from '../../lib/format';
import { AmountInput } from '../../ui/AmountInput';
import { ConfirmDialog, Dialog } from '../../ui/Dialog';
import { TransactionRow } from '../../ui/TransactionRow';
import { Alert, Button, ButtonLink, Card, EmptyState, Field, Money, PageHeader } from '../../ui/controls';
import { useToast } from '../../ui/toast';
import { AccountKindBadge, Receipt } from '../../ui/icons';

const RECENT_LIMIT = 30;

export function AccountDetailPage() {
  const { id = '' } = useParams();
  const { accountsById, balances, transactions, today, bills } = useData();
  const account = accountsById.get(id);
  const navigate = useNavigate();
  const toast = useToast();
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const related = useMemo(
    () => sortNewestFirst(transactions.filter((tx) => tx.accountId === id || tx.toAccountId === id)),
    [transactions, id],
  );

  if (!account) {
    return (
      <>
        <PageHeader title="Akun" back="/akun" />
        <div className="p-4">
          <Alert tone="info">Akun tidak ditemukan.</Alert>
        </div>
      </>
    );
  }

  const balance = balances.get(account.id) ?? 0;
  const isLiability = account.group === 'liability';
  const canDelete = !hasTransactions(account.id, transactions);

  async function toggleArchive() {
    setError(null);
    try {
      await setAccountArchived(db, account!.id, !account!.archived);
      toast({ message: account!.archived ? 'Akun diaktifkan kembali' : 'Akun diarsipkan' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengubah status akun.');
    }
  }

  async function remove() {
    setDeleteOpen(false);
    try {
      await deleteAccount(db, account!.id);
      toast({ message: 'Akun dihapus' });
      navigate('/akun', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menghapus akun.');
    }
  }

  return (
    <>
      <PageHeader title={account.name} back="/akun" actions={<ButtonLink to={`/akun/${account.id}/ubah`} variant="ghost">Ubah</ButtonLink>} />
      <div className="flex flex-col gap-4 p-4">
        <Card>
          <div className="flex items-center gap-3">
            <AccountKindBadge kind={account.kind} size="lg" />
            <div>
              <p className="text-sm text-slate-500">
                {ACCOUNT_KIND_LABEL[account.kind]}
                {account.archived && ' · diarsipkan'}
              </p>
              <p className="text-2xl font-bold">
                <Money value={balance} />
              </p>
              {isLiability && <p className="text-sm text-slate-500">terutang</p>}
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {isLiability ? 'Utang awal' : 'Saldo awal'} <Money value={account.openingBalance} /> per{' '}
            {formatDisplayDate(account.openingDate)}
            {account.group === 'asset' && !account.includeInAvailable && ' · tidak dihitung di Uang tersedia'}
          </p>
        </Card>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setAdjustOpen(true)} disabled={account.archived}>
            Sesuaikan saldo
          </Button>
          <Button variant="secondary" onClick={toggleArchive}>
            {account.archived ? 'Aktifkan kembali' : 'Arsipkan'}
          </Button>
        </div>
        {error && <Alert>{error}</Alert>}
        {isLiability && !account.archived && !bills.some((b) => b.toAccountId === account.id) && (
          <Alert tone="info">
            Ingin diingatkan saat tagihan {account.name} jatuh tempo?{' '}
            <Link to={`/tagihan/baru?ke=${account.id}`} className="font-semibold underline">
              Buat tagihan bulanan
            </Link>
          </Alert>
        )}

        <section aria-labelledby="account-tx">
          <h2 id="account-tx" className="mb-2 flex items-center justify-between px-1 text-sm font-semibold text-slate-600">
            <span>Transaksi</span>
            {related.length > RECENT_LIMIT && (
              <ButtonLink to={`/transaksi?akun=${account.id}`} variant="ghost" className="min-h-11">
                Lihat semua ({related.length})
              </ButtonLink>
            )}
          </h2>
          {related.length === 0 ? (
            <Card>
              <EmptyState icon={Receipt} title="Belum ada transaksi di akun ini" />
            </Card>
          ) : (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {related.slice(0, RECENT_LIMIT).map((tx) => (
                <li key={tx.id}>
                  <TransactionRow tx={tx} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {canDelete && (
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            Hapus akun
          </Button>
        )}
      </div>

      <AdjustDialog
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        account={account}
        balance={balance}
        onDone={async (actual) => {
          const tx = await adjustBalance(db, { id: crypto.randomUUID(), accountId: account.id, actualBalance: actual, today });
          setAdjustOpen(false);
          if (tx) {
            toast({
              message: 'Saldo disesuaikan',
              actionLabel: 'Batalkan',
              onAction: () => deleteTransaction(db, tx.id).then(() => undefined),
            });
          }
        }}
      />
      <ConfirmDialog
        open={deleteOpen}
        title="Hapus akun?"
        message={`Akun ${account.name} akan dihapus permanen. Akun ini belum punya transaksi.`}
        confirmLabel="Hapus"
        danger
        onConfirm={remove}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  );
}

function AdjustDialog({
  open,
  onClose,
  account,
  balance,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  account: Account;
  balance: Rupiah;
  onDone: (actual: Rupiah) => Promise<void>;
}) {
  const { today } = useData();
  const [actual, setActual] = useState<Rupiah | null>(null);
  const [saving, setSaving] = useState(false);
  const isLiability = account.group === 'liability';
  const plan = actual === null ? null : planAdjustment(account.id, balance, actual, today);

  return (
    <Dialog
      open={open}
      onClose={() => {
        setActual(null);
        onClose();
      }}
      title="Sesuaikan saldo"
      footer={
        <Button
          block
          disabled={actual === null || saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onDone(actual!);
              setActual(null);
            } finally {
              setSaving(false);
            }
          }}
        >
          {plan ? 'Simpan penyesuaian' : 'Tutup'}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-600">
          {isLiability
            ? 'Masukkan jumlah terutang sebenarnya sesuai tagihan atau aplikasi kartu/pinjaman Anda.'
            : 'Masukkan saldo sebenarnya sesuai aplikasi bank, e-wallet, atau isi dompet Anda.'}
        </p>
        <Field label={isLiability ? 'Jumlah terutang sebenarnya' : 'Saldo sebenarnya'}>
          <AmountInput value={actual} onChange={setActual} size="large" autoFocus />
        </Field>
        <dl className="grid grid-cols-[1fr_auto] gap-y-1 rounded-xl bg-slate-50 p-3 text-sm">
          <dt className="text-slate-500">Di aplikasi</dt>
          <dd>
            <Money value={balance} />
          </dd>
          <dt className="text-slate-500">Sebenarnya</dt>
          <dd>{actual === null ? '—' : <Money value={actual} />}</dd>
          <dt className="font-semibold">Selisih</dt>
          <dd className="font-semibold">
            {plan ? <Money value={plan.difference} prefix={plan.difference > 0 ? '+' : ''} /> : actual === null ? '—' : 'Rp0 (sudah cocok)'}
          </dd>
        </dl>
        <p className="text-xs text-slate-500">
          Selisih dicatat sebagai &quot;Penyesuaian saldo&quot; bertanggal hari ini dan tidak masuk pemasukan, pengeluaran, atau
          anggaran.
        </p>
      </div>
    </Dialog>
  );
}
