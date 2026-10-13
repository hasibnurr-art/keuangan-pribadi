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
import { HomePage } from './features/home/HomePage';
import { MorePage } from './features/more/MorePage';
import { OnboardingPage } from './features/onboarding/OnboardingPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { TransactionFormPage } from './features/transactions/TransactionFormPage';
import { TransactionsPage } from './features/transactions/TransactionsPage';
import { UpdateBanner } from './app/UpdateBanner';
import { ToastProvider } from './ui/toast';

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center text-slate-500" role="status">
      Memuat…
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

export default function App() {
  return (
    <ToastProvider>
      <UpdateBanner />
      <RouterProvider router={router} />
    </ToastProvider>
  );
}
