// Pengaturan key-value (PRD §7, `Setting`).

import type { KeuanganDB } from './schema';

export interface SettingValues {
  onboardingDone: boolean;
  lastBackupAt: string | null;
  lastDataChangeAt: string | null;
  backupReminderDays: number;
  hideAmounts: boolean;
  feeCategoryId: string | null;
  lastUsedAccountId: string | null;
  installHintDismissed: boolean;
  /** Tanggal lokal saat banner pengingat backup ditutup (tampil lagi besok). */
  backupBannerDismissedOn: string | null;
}

export type SettingKey = keyof SettingValues;

export const SETTING_DEFAULTS: SettingValues = {
  onboardingDone: false,
  lastBackupAt: null,
  lastDataChangeAt: null,
  backupReminderDays: 7,
  hideAmounts: false,
  feeCategoryId: null,
  lastUsedAccountId: null,
  installHintDismissed: false,
  backupBannerDismissedOn: null,
};

export async function getSetting<K extends SettingKey>(db: KeuanganDB, key: K): Promise<SettingValues[K]> {
  const row = await db.settings.get(key);
  return row === undefined ? SETTING_DEFAULTS[key] : (row.value as SettingValues[K]);
}

export async function setSetting<K extends SettingKey>(
  db: KeuanganDB,
  key: K,
  value: SettingValues[K],
): Promise<void> {
  await db.settings.put({ key, value });
}

export async function getAllSettings(db: KeuanganDB): Promise<SettingValues> {
  const rows = await db.settings.toArray();
  const values = { ...SETTING_DEFAULTS } as Record<string, unknown>;
  for (const row of rows) if (row.key in values) values[row.key] = row.value;
  return values as unknown as SettingValues;
}
