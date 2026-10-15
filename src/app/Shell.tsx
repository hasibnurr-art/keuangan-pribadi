import { NavLink, Outlet, useLocation } from 'react-router';
import { cx } from '../ui/controls';
import { ChartPieSlice, House, ICON, ListBullets, Plus, SquaresFour } from '../ui/icons';

const NAV = [
  { to: '/', label: 'Beranda', icon: House, end: true },
  { to: '/transaksi', label: 'Transaksi', icon: ListBullets, end: true },
  { to: '/laporan', label: 'Laporan', icon: ChartPieSlice, end: true },
  { to: '/lainnya', label: 'Lainnya', icon: SquaresFour, end: false },
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
        className="sr-only z-50 rounded-[14px] bg-brand-800 px-4 py-3 font-semibold text-on-brand focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Lewati ke konten
      </a>
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-surface lg:block">
        <div className="sticky top-0 flex h-dvh flex-col gap-1 p-4">
          <p className="mb-5 flex items-center gap-2.5 px-2 pt-2 text-lg font-extrabold tracking-tight">
            <img src="./favicon.svg" alt="" className="size-9 rounded-[11px]" />
            Dompet Waras
          </p>
          <NavLink
            to="/transaksi/baru"
            className="mb-4 flex min-h-12 items-center justify-center gap-2 rounded-[14px] bg-brand-700 font-semibold text-on-brand hover:bg-brand-800 active:bg-brand-900"
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
                  'flex min-h-11 items-center gap-3 rounded-[14px] px-3 font-semibold transition-colors',
                  isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-100',
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
        <main id="konten" tabIndex={-1} className={cx('outline-none', !fullscreen && 'pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-8')}>
          <Outlet />
        </main>
      </div>

      {!fullscreen && (
        <nav
          aria-label="Navigasi utama"
          className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-md rounded-3xl border border-slate-200 bg-surface/90 shadow-[0_10px_30px_rgb(0_0_0/0.12)] backdrop-blur-lg lg:hidden"
        >
          <ul className="grid h-[4.25rem] grid-cols-5 items-center">
            {NAV.slice(0, 2).map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
            <li className="flex justify-center">
              <NavLink
                to="/transaksi/baru"
                aria-label="Tambah transaksi"
                className="flex size-[3.25rem] items-center justify-center rounded-[18px] bg-brand-700 text-on-brand shadow-[0_8px_20px_rgb(11_106_96/0.35)] transition-transform hover:bg-brand-800 active:scale-95"
              >
                <Plus size={26} weight="bold" />
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
            'flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors',
            isActive ? 'text-brand-700' : 'text-slate-500 hover:text-slate-700',
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
