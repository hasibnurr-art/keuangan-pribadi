// Onboarding (PRD §9.1). Bisa diulang tanpa membuat akun/kategori ganda.

import { DEFAULT_CATEGORIES, DEFAULT_FEE_CATEGORY_ID } from '../domain/defaults';
import type { AccountDraft } from '../domain/entityRules';
import type { LocalDate } from '../domain/types';
import { saveAccount } from './accounts';
import type { KeuanganDB } from './schema';
import { getSetting, setSetting } from './settings';

/** Isi kategori default yang belum ada (berdasarkan ID tetap). */
export async function seedDefaultCategories(db: KeuanganDB): Promise<void> {
  await db.transaction('rw', [db.categories, db.settings], async () => {
    const existingIds = new Set(await db.categories.toCollection().primaryKeys());
    const missing = DEFAULT_CATEGORIES.filter((c) => !existingIds.has(c.id));
    if (missing.length > 0) await db.categories.bulkAdd(missing);
    if ((await getSetting(db, 'feeCategoryId')) === null) {
      await setSetting(db, 'feeCategoryId', DEFAULT_FEE_CATEGORY_ID);
    }
  });
}

export async function completeOnboarding(
  db: KeuanganDB,
  firstAccount: AccountDraft,
  { today, now = new Date() }: { today: LocalDate; now?: Date },
): Promise<void> {
  await db.transaction('rw', [db.accounts, db.categories, db.transactions, db.settings], async () => {
    await seedDefaultCategories(db);
    await saveAccount(db, firstAccount, { today, now });
    await setSetting(db, 'lastUsedAccountId', firstAccount.id);
    await setSetting(db, 'onboardingDone', true);
  });
}
