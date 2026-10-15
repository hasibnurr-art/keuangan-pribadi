import { useRef, type InputHTMLAttributes } from 'react';
import type { Rupiah } from '../domain/types';
import { formatAmountInput, parseAmountInput } from '../lib/money';
import { cx } from './controls';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'size'> & {
  value: Rupiah | null;
  onChange: (value: Rupiah | null) => void;
  /** `hero`: angka besar di tengah tanpa kotak (form transaksi). */
  size?: 'normal' | 'large' | 'hero';
  /** Tampilkan tombol pintasan `000`. */
  withThousands?: boolean;
};

const QUICK_ADD = [10_000, 50_000, 100_000];

/** Input nominal rupiah: keypad numerik, pemisah ribuan otomatis saat mengetik. */
export function AmountInput({ value, onChange, size = 'normal', withThousands, className, ...props }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const text = formatAmountInput(value);

  function appendThousands() {
    onChange(parseAmountInput(`${value ?? ''}000`));
    ref.current?.focus();
  }

  const thousandsButton = withThousands && (
    <button
      type="button"
      className={cx(
        'min-h-11 rounded-full bg-slate-100 px-4 text-sm font-bold text-slate-700 hover:bg-slate-200 active:bg-slate-300',
        size !== 'hero' && 'rounded-[10px] px-3',
      )}
      onClick={appendThousands}
    >
      000
    </button>
  );

  if (size === 'hero') {
    return (
      <div className={cx('flex flex-col items-center gap-4', className)}>
        <div className="flex max-w-full min-w-0 items-baseline justify-center gap-1.5 border-b-2 border-transparent px-2 pb-1 transition-colors focus-within:border-brand-600 has-[[aria-invalid=true]]:border-red-500">
          <span className="text-2xl font-bold text-slate-400" aria-hidden>
            Rp
          </span>
          <input
            ref={ref}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            className="tabular max-w-full min-w-0 bg-transparent text-center text-[2.75rem] leading-tight font-extrabold tracking-tight outline-none placeholder:text-slate-300"
            style={{ width: `${Math.max(1, text.length) + 0.6}ch` }}
            value={text}
            onChange={(e) => onChange(parseAmountInput(e.target.value))}
            {...props}
          />
        </div>
        {withThousands && (
          <div className="flex flex-wrap justify-center gap-2">
            {thousandsButton}
            {QUICK_ADD.map((add) => (
              <button
                key={add}
                type="button"
                className="min-h-11 rounded-full bg-slate-100 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-200 active:bg-slate-300"
                onClick={() => onChange((value ?? 0) + add)}
              >
                +{add / 1000} rb
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const large = size === 'large';
  return (
    <div
      className={cx(
        'flex items-center gap-2 rounded-[14px] border border-slate-200 bg-surface px-3.5 transition-colors focus-within:border-brand-600 has-[[aria-invalid=true]]:border-red-500',
        large ? 'min-h-16' : 'min-h-12',
        className,
      )}
    >
      <span className={cx('font-semibold text-slate-400', large ? 'text-2xl' : 'text-base')} aria-hidden>
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
          large ? 'text-3xl font-extrabold tracking-tight' : 'text-base',
        )}
        value={text}
        onChange={(e) => onChange(parseAmountInput(e.target.value))}
        {...props}
      />
      {thousandsButton}
    </div>
  );
}
