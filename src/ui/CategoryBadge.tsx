import { cx } from './controls';

// Kelas lengkap ditulis eksplisit agar terdeteksi Tailwind.
export const COLOR_CLASSES: Record<string, string> = {
  slate: 'bg-slate-100',
  stone: 'bg-stone-200',
  red: 'bg-red-100',
  orange: 'bg-orange-100',
  amber: 'bg-amber-100',
  lime: 'bg-lime-100',
  emerald: 'bg-emerald-100',
  teal: 'bg-teal-100',
  sky: 'bg-sky-100',
  indigo: 'bg-indigo-100',
  violet: 'bg-violet-100',
  fuchsia: 'bg-fuchsia-100',
  pink: 'bg-pink-100',
  rose: 'bg-rose-100',
};

export const SWATCH_CLASSES: Record<string, string> = {
  slate: 'bg-slate-400',
  stone: 'bg-stone-400',
  red: 'bg-red-400',
  orange: 'bg-orange-400',
  amber: 'bg-amber-400',
  lime: 'bg-lime-400',
  emerald: 'bg-emerald-400',
  teal: 'bg-teal-400',
  sky: 'bg-sky-400',
  indigo: 'bg-indigo-400',
  violet: 'bg-violet-400',
  fuchsia: 'bg-fuchsia-400',
  pink: 'bg-pink-400',
  rose: 'bg-rose-400',
};

export function CategoryBadge({ icon, color, size = 'md' }: { icon: string; color: string; size?: 'sm' | 'md' }) {
  return (
    <span
      aria-hidden
      className={cx(
        'flex shrink-0 items-center justify-center rounded-full',
        size === 'md' ? 'size-10 text-xl' : 'size-8 text-base',
        COLOR_CLASSES[color] ?? COLOR_CLASSES.slate,
      )}
    >
      {icon}
    </span>
  );
}
