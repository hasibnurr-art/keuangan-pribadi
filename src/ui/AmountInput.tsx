import { useRef, type InputHTMLAttributes } from 'react';
import type { Rupiah } from '../domain/types';
import { formatAmountInput, parseAmountInput } from '../lib/money';
import { cx } from './controls';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'size'> & {
  value: Rupiah | null;
  onChange: (value: Rupiah | null) => void;
  size?: 'normal' | 'large';
  /** Tampilkan tombol pintasan `000`. */
  withThousands?: boolean;
};

/** Input nominal rupiah: keypad numerik, pemisah ribuan otomatis saat mengetik. */
export function AmountInput({ value, onChange, size = 'normal', withThousands, className, ...props }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const large = size === 'large';

  return (
    <div
      className={cx(
        'flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 has-[[aria-invalid=true]]:border-red-500',
        large ? 'min-h-16' : 'min-h-11',
        className,
      )}
    >
      <span className={cx('font-semibold text-slate-500', large ? 'text-2xl' : 'text-base')} aria-hidden>
        Rp
      </span>
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="0"
        className={cx(
          'tabular min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-300',
          large ? 'text-3xl font-bold' : 'text-base',
        )}
        value={formatAmountInput(value)}
        onChange={(e) => onChange(parseAmountInput(e.target.value))}
        {...props}
      />
      {withThousands && (
        <button
          type="button"
          className="min-h-10 rounded-lg bg-slate-100 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          onClick={() => {
            onChange(parseAmountInput(`${value ?? ''}000`));
            ref.current?.focus();
          }}
        >
          000
        </button>
      )}
    </div>
  );
}
