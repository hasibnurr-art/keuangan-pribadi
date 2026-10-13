import { useState } from 'react';
import { useData } from '../../app/data';
import { ButtonLink, Card, EmptyState, PageHeader } from '../../ui/controls';
import { GoalCard } from './GoalCard';

export function GoalsPage() {
  const { goals } = useData();
  const [showArchived, setShowArchived] = useState(false);
  const active = goals.filter((g) => !g.archived).sort((a, b) => a.targetMonth.localeCompare(b.targetMonth));
  const archived = goals.filter((g) => g.archived);
  const hasEmergency = active.some((g) => g.kind === 'emergency');

  return (
    <>
      <PageHeader title="Target tabungan" back actions={<ButtonLink to="/target/baru" variant="ghost">+ Target</ButtonLink>} />
      <div className="flex flex-col gap-4 p-4">
        {active.length === 0 ? (
          <Card>
            <EmptyState icon="🎯" title="Belum ada target tabungan">
              <p className="mb-4">
                Tetapkan target seperti DP rumah, kendaraan, atau pendidikan. Aplikasi menghitung berapa yang perlu ditabung
                tiap bulan dan memberi tahu apakah Anda sesuai jadwal.
              </p>
              <div className="flex flex-col gap-2">
                <ButtonLink to="/target/baru?jenis=darurat">🛟 Mulai dengan Dana Darurat</ButtonLink>
                <ButtonLink to="/target/baru" variant="secondary">
                  🎯 Target lain
                </ButtonLink>
              </div>
            </EmptyState>
          </Card>
        ) : (
          <>
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {active.map((goal) => (
                <li key={goal.id}>
                  <GoalCard goal={goal} />
                </li>
              ))}
            </ul>
            {!hasEmergency && (
              <p className="rounded-2xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-900">
                💡 Belum punya Dana Darurat? Biasanya disarankan 3–6 bulan pengeluaran sebelum target lain.{' '}
                <a href="#/target/baru?jenis=darurat" className="font-semibold underline">
                  Buat sekarang
                </a>
              </p>
            )}
          </>
        )}

        {archived.length > 0 && (
          <section>
            <button
              type="button"
              className="min-h-11 text-sm font-semibold text-brand-700"
              onClick={() => setShowArchived(!showArchived)}
            >
              {showArchived ? 'Sembunyikan target selesai' : `Tampilkan ${archived.length} target selesai/diarsipkan`}
            </button>
            {showArchived && (
              <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white opacity-80">
                {archived.map((goal) => (
                  <li key={goal.id}>
                    <GoalCard goal={goal} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </>
  );
}
