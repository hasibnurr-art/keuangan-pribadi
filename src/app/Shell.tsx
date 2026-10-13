import { NavLink, Outlet, useLocation } from 'react-router';
import { cx } from '../ui/controls';
import { ChartBar, DotsThreeOutline, House, ICON, Plus, Receipt } from '../ui/icons';

const NAV = [
  { to: '/', label: 'Beranda', icon: House, end: true },
  { to: '/transaksi', label: 'Transaksi', icon: Receipt, end: true },
  { to: '/laporan', label: 'Laporan', icon: ChartBar, end: true },
  { to: '/lainnya', label: 'Lainnya', icon: DotsThreeOutline, end: false },
];

/** Form layar penuh tidak menampilkan navigasi bawah agar fokus. */
const FULLSCREEN = /^\/(transaksi\/.+|tagihan\/.+|akun\/(baru|[^/]+\/ubah)|target\/(baru|[^/]+\/ubah))$/;

export function Shell() {
  const { pathname } = useLocation();
  const fullscreen = FULLSCREEN.test(pathname);

  return (
    <div className="min-h-dvh lg:flex">
      <a
        href="#konten"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('konten')?.focus();
        }}
        className="sr-only z-50 rounded-xl bg-brand-800 px-4 py-3 font-semibold text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Lewati ke konten
      </a>
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white lg:block">
        <div className="sticky top-0 flex h-dvh flex-col gap-1 p-4">
          <p className="mb-4 px-3 text-lg font-bold text-brand-800">Keuangan Pribadi</p>
          <NavLink
            to="/transaksi/baru"
            className="mb-3 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-700 font-semibold text-white hover:bg-brand-800 active:bg-brand-900"
          >
            <Plus size={ICON.md} weight="bold" /> Tambah transaksi
          </NavLink>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cx(
                  'flex min-h-11 items-center gap-3 rounded-xl px-3 font-medium',
                  isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-700 hover:bg-slate-100',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={ICON.md} weight={isActive ? 'fill' : 'regular'} />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </aside>

      <div className="mx-auto w-full max-w-3xl flex-1 lg:px-6">
        <main id="konten" tabIndex={-1} className={cx('outline-none', !fullscreen && 'pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-8')}>
          <Outlet />
        </main>
      </div>

      {!fullscreen && (
        <nav
          aria-label="Navigasi utama"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          <ul className="mx-auto grid max-w-md grid-cols-5 items-center">
            {NAV.slice(0, 2).map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
            <li className="flex justify-center">
              <NavLink
                to="/transaksi/baru"
                aria-label="Tambah transaksi"
                className="-mt-6 flex size-14 items-center justify-center rounded-full bg-brand-700 text-3xl text-white shadow-lg hover:bg-brand-800 active:bg-brand-900"
              >
                <Plus size={ICON.lg} weight="bold" />
              </NavLink>
            </li>
            {NAV.slice(2).map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}

function NavItem({ to, label, icon: Icon, end }: (typeof NAV)[number]) {
  return (
    <li>
      <NavLink
        to={to}
        end={end}
        className={({ isActive }) =>
          cx(
            'flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium',
            isActive ? 'text-brand-700' : 'text-slate-500',
          )
        }
      >
        {({ isActive }) => (
          <>
            <Icon size={ICON.lg} weight={isActive ? 'fill' : 'regular'} />
            {label}
          </>
        )}
      </NavLink>
    </li>
  );
}
