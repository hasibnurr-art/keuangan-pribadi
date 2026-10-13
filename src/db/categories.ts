// Operasi tulis kategori (PRD §9.6).

import { validateArchiveCategory, validateCategory, type CategoryDraft } from '../domain/entityRules';
import type { Category, CategoryType, ID } from '../domain/types';
import type { KeuanganDB } from './schema';
import { touchData } from './transactions';

export async function saveCategory(db: KeuanganDB, draft: CategoryDraft, now: Date = new Date()): Promise<Category> {
  return db.transaction('rw', [db.categories, db.settings], async () => {
    const categories = await db.categories.toArray();
    const error = validateCategory(draft, categories).name;
    if (error) throw new Error(error);
    const existing = categories.find((c) => c.id === draft.id);
    if (existing && existing.type !== draft.type) throw new Error('Jenis kategori tidak bisa diubah.');
    const category: Category = {
      ...draft,
      name: draft.name.trim(),
      archived: existing?.archived ?? false,
      sortOrder:
        existing?.sortOrder ??
        categories.filter((c) => c.type === draft.type).reduce((max, c) => Math.max(max, c.sortOrder + 1), 0),
    };
    await db.categories.put(category);
    await touchData(db, now);
    return category;
  });
}

export async function setCategoryArchived(
  db: KeuanganDB,
  categoryId: ID,
  archived: boolean,
  now: Date = new Date(),
): Promise<void> {
  await db.transaction('rw', [db.categories, db.settings], async () => {
    const categories = await db.categories.toArray();
    const category = categories.find((c) => c.id === categoryId);
    if (!category) throw new Error('Kategori tidak ditemukan.');
    if (archived) {
      const error = validateArchiveCategory(category, categories);
      if (error) throw new Error(error);
    } else {
      const error = validateCategory(category, categories).name;
      if (error) throw new Error(`${error} Ganti nama kategori aktif tersebut dulu.`);
    }
    await db.categories.put({ ...category, archived });
    await touchData(db, now);
  });
}

/** Tukar urutan kategori dengan tetangganya di antara kategori aktif sejenis. */
export async function moveCategory(
  db: KeuanganDB,
  categoryId: ID,
  direction: -1 | 1,
  now: Date = new Date(),
): Promise<void> {
  await db.transaction('rw', [db.categories, db.settings], async () => {
    const category = await db.categories.get(categoryId);
    if (!category) return;
    const siblings = await activeSorted(db, category.type);
    const index = siblings.findIndex((c) => c.id === categoryId);
    const neighbor = siblings[index + direction];
    if (!neighbor) return;
    // Normalisasi urutan agar pertukaran selalu berhasil walau sortOrder sama.
    siblings[index] = neighbor;
    siblings[index + direction] = category;
    await db.categories.bulkPut(siblings.map((c, i) => ({ ...c, sortOrder: i })));
    await touchData(db, now);
  });
}

async function activeSorted(db: KeuanganDB, type: CategoryType): Promise<Category[]> {
  const list = await db.categories.where('type').equals(type).toArray();
  return list.filter((c) => !c.archived).sort((a, b) => a.sortOrder - b.sortOrder);
}
