import { IconContext } from '@phosphor-icons/react/dist/lib/context';
import { useEffect, useState } from 'react';
import { Navigate, RouterProvider, createHashRouter } from 'react-router';
import { DataProvider, useSettings } from './app/data';
import { Shell } from './app/Shell';
import { AccountDetailPage } from './features/accounts/AccountDetailPage';
import { AccountFormPage } from './features/accounts/AccountFormPage';
import { AccountsPage } from './features/accounts/AccountsPage';
import { BillFormPage } from './features/bills/BillFormPage';
import { BillsPage } from './features/bills/BillsPage';
import { BudgetsPage } from './features/budgets/BudgetsPage';
import { CategoriesPage } from './features/categories/CategoriesPage';
import { DataPage } from './features/data/DataPage';
import { GoalDetailPage } from './features/goals/GoalDetailPage';
import { GoalFormPage } from './features/goals/GoalFormPage';
import { GoalsPage } from './features/goals/GoalsPage';
import { HomePage } from './features/home/HomePage';
import { MorePage } from './features/more/MorePage';
import { OnboardingPage } from './features/onboarding/OnboardingPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { TransactionFormPage } from './features/transactions/TransactionFormPage';
import { TransactionsPage } from './features/transactions/TransactionsPage';
import { UpdateBanner } from './app/UpdateBanner';
import { RouteError } from './safe/RouteError';
import { SAFE_MODE_URL } from './safe/diagnostics';
import { ToastProvider } from './ui/toast';

/** Layar memuat. Jika lebih dari 8 detik, tawarkan muat ulang dan Mode aman. */
function Splash() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 8_000);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center text-slate-500" role="status">
      <p>Memuat…</p>
      {slow && (
        <div className="flex max-w-xs flex-col gap-2 text-sm">
          <p className="text-slate-700">Aplikasi belum merespons. Data Anda tetap tersimpan.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-11 rounded-xl bg-brand-700 font-semibold text-white"
          >
            Muat ulang
          </button>
          <a href={SAFE_MODE_URL} className="min-h-11 rounded-xl border border-slate-300 bg-white py-3 font-semibold text-slate-800">
            Buka Mode aman
          </a>
        </div>
      )}
    </div>
  );
}

/** Tampilkan onboarding sampai selesai; setelah itu aplikasi utama. */
function Root() {
  const settings = useSettings();
  if (!settings) return <Splash />;
  if (!settings.onboardingDone) return <OnboardingPage />;
  return (
    <DataProvider fallback={<Splash />}>
      <Shell />
    </DataProvider>
  );
}

const router = createHashRouter([
  {
    path: '/',
    element: <Root />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'transaksi', element: <TransactionsPage /> },
      { path: 'transaksi/baru', element: <TransactionFormPage /> },
      { path: 'transaksi/:id', element: <TransactionFormPage /> },
      { path: 'akun', element: <AccountsPage /> },
      { path: 'akun/baru', element: <AccountFormPage /> },
      { path: 'akun/:id', element: <AccountDetailPage /> },
      { path: 'akun/:id/ubah', element: <AccountFormPage /> },
      { path: 'kategori', element: <CategoriesPage /> },
      { path: 'anggaran', element: <BudgetsPage /> },
      { path: 'target', element: <GoalsPage /> },
      { path: 'target/baru', element: <GoalFormPage /> },
      { path: 'target/:id', element: <GoalDetailPage /> },
      { path: 'target/:id/ubah', element: <GoalFormPage /> },
      { path: 'tagihan', element: <BillsPage /> },
      { path: 'tagihan/baru', element: <BillFormPage /> },
      { path: 'tagihan/:id', element: <BillFormPage /> },
      { path: 'laporan', element: <ReportsPage /> },
      { path: 'lainnya', element: <MorePage /> },
      { path: 'data', element: <DataPage /> },
      { path: 'pengaturan', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

const ICON_DEFAULTS = { size: 20, weight: 'regular' as const, 'aria-hidden': true, focusable: 'false' as const };

export default function App() {
  return (
    // Ikon dekoratif secara default: teks/label di sebelahnya yang memberi makna.
    <IconContext value={ICON_DEFAULTS}>
      <ToastProvider>
        <UpdateBanner />
        <RouterProvider router={router} />
      </ToastProvider>
    </IconContext>
  );
}
