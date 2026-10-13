import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useData } from '../../app/data';
import { hasTransactions, type AccountDraft, type AccountErrors } from '../../domain/entityRules';
import { db } from '../../db';
import { AccountValidationError, saveAccount } from '../../db/accounts';
import { Alert, Button, PageHeader } from '../../ui/controls';
import { AccountFields, newAccountDraft } from './AccountFields';

export function AccountFormPage() {
  const { id } = useParams();
  const { accountsById, transactions, today } = useData();
  const existing = id ? accountsById.get(id) : undefined;
  const navigate = useNavigate();

  const [draft, setDraft] = useState<AccountDraft>(() => (existing ? { ...existing } : newAccountDraft(today)));
  const [errors, setErrors] = useState<AccountErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (id && !existing) {
    return (
      <>
        <PageHeader title="Ubah akun" back />
        <div className="p-4">
          <Alert tone="info">Akun tidak ditemukan.</Alert>
        </div>
      </>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFailure(null);
    try {
      const saved = await saveAccount(db, draft, { today });
      navigate(`/akun/${saved.id}`, { replace: true });
    } catch (error) {
      if (error instanceof AccountValidationError) setErrors(error.errors);
      else setFailure('Gagal menyimpan akun. Coba lagi.');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-dvh flex-col">
      <PageHeader title={existing ? 'Ubah akun' : 'Tambah akun'} back />
      <div className="flex-1 p-4">
        <AccountFields
          draft={draft}
          onChange={setDraft}
          errors={errors}
          today={today}
          isNew={!existing}
          groupLocked={!!existing && hasTransactions(existing.id, transactions)}
        />
        {failure && (
          <div className="mt-4">
            <Alert>{failure}</Alert>
          </div>
        )}
      </div>
      <div className="sticky bottom-0 border-t border-slate-200 bg-white px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <Button type="submit" block disabled={saving}>
          {saving ? 'Menyimpan…' : 'Simpan akun'}
        </Button>
      </div>
    </form>
  );
}
