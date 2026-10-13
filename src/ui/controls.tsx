// Komponen dasar: tombol, field berlabel, input, kartu, dll.

import {
  cloneElement,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { Link, useNavigate } from 'react-router';
import { useOptionalData } from '../app/data';
import type { Rupiah } from '../domain/types';
import { formatRupiah } from '../lib/money';
import { CaretLeft, ICON, type Icon } from './icons';

export const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900 disabled:bg-slate-300',
  secondary: 'border border-slate-300 bg-white text-slate-800 pressable disabled:text-slate-400',
  danger: 'border border-red-200 bg-white text-red-700 hover:bg-red-50 active:bg-red-100 disabled:text-slate-400',
  ghost: 'text-brand-700 hover:bg-brand-50 active:bg-brand-100 disabled:text-slate-400',
};

export function Button({
  variant = 'primary',
  block,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; block?: boolean }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed',
        VARIANTS[variant],
        block && 'w-full',
        className,
      )}
      {...props}
    />
  );
}

export function ButtonLink({ to, variant = 'primary', className, children }: { to: string; variant?: Variant; className?: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className={cx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors',
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </Link>
  );
}

/** Field berlabel. Child menerima id, aria-invalid, dan aria-describedby otomatis. */
export function Field({
  label,
  error,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  children: ReactElement<{ id?: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }>;
  className?: string;
}) {
  const id = useId();
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      {cloneElement(children, { id, 'aria-invalid': !!error, 'aria-describedby': describedBy })}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

const inputClass =
  'min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 placeholder:text-slate-400 aria-invalid:border-red-500 disabled:bg-slate-100';

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(inputClass, className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(inputClass, 'appearance-auto', className)} {...props} />;
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cx('rounded-2xl border border-slate-200 bg-white p-4 shadow-sm', className)}>{children}</section>;
}

/** true jika pengguna menyembunyikan nominal (F-14). */
export function useAmountsHidden(): boolean {
  return useOptionalData()?.settings.hideAmounts ?? false;
}

/** Nominal rupiah. Menghormati pengaturan "Sembunyikan nominal". */
export function Money({
  value,
  className,
  prefix = '',
  tabular = true,
}: {
  value: Rupiah;
  className?: string;
  prefix?: string;
  /** Angka tabular untuk kolom; matikan untuk angka besar tunggal (hero). */
  tabular?: boolean;
}) {
  const hidden = useAmountsHidden();
  return (
    <span className={cx(tabular && 'tabular', 'whitespace-nowrap', className)}>
      {hidden ? 'Rp •••••' : `${prefix}${formatRupiah(value)}`}
    </span>
  );
}

export function PageHeader({
  title,
  back,
  actions,
}: {
  title: ReactNode;
  /** true = kembali ke halaman sebelumnya; string = ke path tersebut. */
  back?: boolean | string;
  actions?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-20 flex min-h-14 items-center gap-2 border-b border-slate-200 bg-slate-50/95 px-2 pt-[env(safe-area-inset-top)] backdrop-blur lg:px-0">
      {back && (
        <button
          type="button"
          aria-label="Kembali"
          className="flex size-11 items-center justify-center rounded-full text-xl text-slate-700 hover:bg-slate-200 active:bg-slate-300"
          onClick={() => (typeof back === 'string' ? navigate(back) : goBack(navigate))}
        >
          <CaretLeft size={ICON.lg} />
        </button>
      )}
      <h1 className={cx('flex-1 truncate text-lg font-semibold', !back && 'pl-2 lg:pl-0')}>{title}</h1>
      {actions}
    </header>
  );
}

/** Kembali jika ada riwayat dalam aplikasi; jika tidak, ke beranda. */
export function goBack(navigate: ReturnType<typeof useNavigate>, fallback = '/') {
  if (window.history.state && window.history.state.idx > 0) navigate(-1);
  else navigate(fallback, { replace: true });
}

export function EmptyState({ icon: IconCmp, title, children }: { icon: Icon; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span className="mb-1 flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <IconCmp size={ICON.xl} />
      </span>
      <p className="font-semibold text-slate-800">{title}</p>
      {children && <div className="text-sm text-slate-600">{children}</div>}
    </div>
  );
}

export function Alert({ tone = 'error', children }: { tone?: 'error' | 'info' | 'warning'; children: ReactNode }) {
  const tones = {
    error: 'border-red-200 bg-red-50 text-red-800',
    info: 'border-brand-100 bg-brand-50 text-brand-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
  };
  return (
    <div role={tone === 'error' ? 'alert' : undefined} className={cx('rounded-xl border px-3 py-2 text-sm', tones[tone])}>
      {children}
    </div>
  );
}

/** Pilihan tersegmentasi (tab jenis transaksi, kelompok akun). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-xl bg-slate-200/70 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          disabled={disabled && value !== option.value}
          onClick={() => onChange(option.value)}
          className={cx(
            'min-h-11 flex-1 rounded-lg px-2 text-sm font-semibold transition-colors',
            value === option.value ? 'bg-white text-brand-800 shadow-sm' : 'text-slate-600 disabled:text-slate-400',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
