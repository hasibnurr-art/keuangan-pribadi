import { useState } from 'react';
import { useData } from '../../app/data';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../../domain/defaults';
import type { CategoryDraft } from '../../domain/entityRules';
import type { Category, CategoryType } from '../../domain/types';
import { db } from '../../db';
import { moveCategory, saveCategory, setCategoryArchived } from '../../db/categories';
import { CategoryBadge, SWATCH_CLASSES } from '../../ui/CategoryBadge';
import { Dialog } from '../../ui/Dialog';
import { Alert, Button, Field, PageHeader, Segmented, TextInput, cx } from '../../ui/controls';
import { useToast } from '../../ui/toast';
import { CaretDown, CaretUp, ICON, Plus } from '../../ui/icons';

export function CategoriesPage() {
  const { categories } = useData();
  const [type, setType] = useState<CategoryType>('expense');
  const [editing, setEditing] = useState<CategoryDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const ofType = categories.filter((c) => c.type === type);
  const active = ofType.filter((c) => !c.archived);
  const archived = ofType.filter((c) => c.archived);

  async function unarchive(category: Category) {
    setError(null);
    try {
      await setCategoryArchived(db, category.id, false);
      toast({ message: `${category.name} diaktifkan kembali` });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengaktifkan kategori.');
    }
  }

  return (
    <>
      <PageHeader
        title="Kategori"
        back
        actions={
          <Button
            variant="ghost"
            onClick={() => setEditing({ id: crypto.randomUUID(), name: '', type, icon: '📦', color: 'slate' })}
          >
            <Plus size={ICON.sm} weight="bold" /> Tambah
          </Button>
        }
      />
      <div className="flex flex-col gap-4 p-4">
        <Segmented
          label="Jenis kategori"
          value={type}
          onChange={setType}
          options={[
            { value: 'expense', label: 'Pengeluaran' },
            { value: 'income', label: 'Pemasukan' },
          ]}
        />
        {error && <Alert>{error}</Alert>}

        <ul className="divide-y divide-slate-100 overflow-hidden rounded-[20px] border border-slate-200 bg-surface">
          {active.map((category, index) => (
            <li key={category.id} className="flex items-center gap-1 pr-2">
              <button
                type="button"
                className="flex min-h-14 flex-1 items-center gap-3 px-4 text-left pressable"
                onClick={() => setEditing({ ...category })}
              >
                <CategoryBadge icon={category.icon} color={category.color} />
                <span className="font-medium">{category.name}</span>
              </button>
              <MoveButton label={`Naikkan ${category.name}`} disabled={index === 0} onClick={() => moveCategory(db, category.id, -1)}>
                <CaretUp size={ICON.md} />
              </MoveButton>
              <MoveButton
                label={`Turunkan ${category.name}`}
                disabled={index === active.length - 1}
                onClick={() => moveCategory(db, category.id, 1)}
              >
                <CaretDown size={ICON.md} />
              </MoveButton>
            </li>
          ))}
        </ul>

        {archived.length > 0 && (
          <section aria-labelledby="archived-categories">
            <h2 id="archived-categories" className="mb-2 px-1 text-base font-bold tracking-tight">
              Diarsipkan
            </h2>
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-[20px] border border-slate-200 bg-surface">
              {archived.map((category) => (
                <li key={category.id} className="flex min-h-14 items-center gap-3 px-4">
                  <CategoryBadge icon={category.icon} color={category.color} />
                  <span className="flex-1 text-slate-500">{category.name}</span>
                  <Button variant="ghost" onClick={() => unarchive(category)}>
                    Aktifkan
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {editing && <CategoryDialog draft={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function MoveButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 active:bg-slate-200 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function CategoryDialog({ draft: initial, onClose }: { draft: CategoryDraft; onClose: () => void }) {
  const { categoriesById } = useData();
  const existing = categoriesById.get(initial.id);
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  async function save() {
    setError(null);
    try {
      await saveCategory(db, draft);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan kategori.');
    }
  }

  async function archive() {
    setError(null);
    try {
      await setCategoryArchived(db, draft.id, true);
      toast({ message: `${draft.name} diarsipkan` });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengarsipkan kategori.');
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={existing ? 'Ubah kategori' : 'Tambah kategori'}
      footer={
        <>
          {existing && !existing.archived && (
            <Button variant="danger" onClick={archive}>
              Arsipkan
            </Button>
          )}
          <Button block onClick={save}>
            Simpan
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <CategoryBadge icon={draft.icon} color={draft.color} />
          <p className="font-medium">{draft.name || 'Nama kategori'}</p>
        </div>
        <Field label="Nama" error={error ?? undefined}>
          <TextInput value={draft.name} maxLength={30} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </Field>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-slate-700">Ikon</legend>
          <div className="grid grid-cols-8 gap-1">
            {CATEGORY_ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                aria-label={`Ikon ${icon}`}
                aria-pressed={draft.icon === icon}
                onClick={() => setDraft({ ...draft, icon })}
                className={cx('flex size-10 items-center justify-center rounded-lg text-xl', draft.icon === icon ? 'bg-brand-100 ring-2 ring-brand-600' : 'hover:bg-slate-100')}
              >
                {icon}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-slate-700">Warna</legend>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Warna ${color}`}
                aria-pressed={draft.color === color}
                onClick={() => setDraft({ ...draft, color })}
                className={cx('size-9 rounded-full', SWATCH_CLASSES[color], draft.color === color && 'ring-2 ring-slate-900 ring-offset-2')}
              />
            ))}
          </div>
        </fieldset>
        {existing && (
          <p className="text-xs text-slate-500">
            Kategori yang diarsipkan tidak muncul di pilihan baru, tetapi tetap tampil di riwayat dan laporan.
          </p>
        )}
      </div>
    </Dialog>
  );
}
