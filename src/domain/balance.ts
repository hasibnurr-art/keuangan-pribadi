// Saldo natural (PRD §8.1–8.2):
//  - Aset  : saldo = uang yang dimiliki.
//  - Utang : saldo = uang yang terutang (positif).
// masuk(X, a): aset +a, utang −a.   keluar(X, a): aset −a, utang +a.

import type { Account, ID, LocalDate, Rupiah, Transaction } from './types';

type Flow = 'in' | 'out';

function naturalDelta(account: Account, flow: Flow, amount: Rupiah): Rupiah {
  const sign = (flow === 'in') === (account.group === 'asset') ? 1 : -1;
  return sign * amount;
}

/** Perubahan saldo natural per akun akibat satu transaksi. */
export function transactionEffects(
  tx: Transaction,
  accountsById: ReadonlyMap<ID, Account>,
): Map<ID, Rupiah> {
  const effects = new Map<ID, Rupiah>();
  const add = (accountId: ID | undefined, delta: (a: Account) => Rupiah) => {
    const account = accountId ? accountsById.get(accountId) : undefined;
    if (!account) throw new Error(`Akun ${accountId} tidak ditemukan untuk transaksi ${tx.id}`);
    effects.set(account.id, (effects.get(account.id) ?? 0) + delta(account));
  };

  switch (tx.type) {
    case 'income':
      add(tx.accountId, (a) => naturalDelta(a, 'in', tx.amount));
      break;
    case 'expense':
      add(tx.accountId, (a) => naturalDelta(a, 'out', tx.amount));
      break;
    case 'transfer':
      add(tx.accountId, (a) => naturalDelta(a, 'out', tx.amount));
      add(tx.toAccountId, (a) => naturalDelta(a, 'in', tx.amount));
      break;
    case 'adjustment':
      add(tx.accountId, () => (tx.adjustDirection === 'decrease' ? -tx.amount : tx.amount));
      break;
  }
  return effects;
}

/**
 * Saldo natural setiap akun pada akhir hari `asOf` (default: semua transaksi).
 * Transaksi sebelum `openingDate` akun tidak dihitung untuk akun tersebut.
 */
export function computeBalances(
  accounts: readonly Account[],
  transactions: readonly Transaction[],
  asOf?: LocalDate,
): Map<ID, Rupiah> {
  const accountsById = new Map(accounts.map((a) => [a.id, a]));
  const balances = new Map(accounts.map((a) => [a.id, a.openingBalance]));

  for (const tx of transactions) {
    if (asOf !== undefined && tx.date > asOf) continue;
    for (const [accountId, delta] of transactionEffects(tx, accountsById)) {
      const account = accountsById.get(accountId)!;
      if (tx.date < account.openingDate) continue;
      balances.set(accountId, balances.get(accountId)! + delta);
    }
  }
  return balances;
}

export interface BalanceTotals {
  /** Σ aset aktif yang dihitung di Uang tersedia. */
  totalCash: Rupiah;
  /** Σ utang aktif. */
  totalDebt: Rupiah;
  /** Σ semua aset − Σ semua utang. */
  netWorth: Rupiah;
}

export function computeTotals(
  accounts: readonly Account[],
  balances: ReadonlyMap<ID, Rupiah>,
): BalanceTotals {
  let totalCash = 0;
  let totalDebt = 0;
  let netWorth = 0;
  for (const account of accounts) {
    const balance = balances.get(account.id) ?? 0;
    if (account.group === 'asset') {
      netWorth += balance;
      if (!account.archived && account.includeInAvailable) totalCash += balance;
    } else {
      netWorth -= balance;
      if (!account.archived) totalDebt += balance;
    }
  }
  return { totalCash, totalDebt, netWorth };
}
