import type { Account, ID } from '../domain/types';
import { Select } from './controls';

/** Pilihan akun dikelompokkan Aset / Utang. */
export function AccountSelect({
  accounts,
  value,
  onChange,
  placeholder,
  ...props
}: {
  accounts: Account[];
  value: ID;
  onChange: (id: ID) => void;
  placeholder?: boolean;
}) {
  const assets = accounts.filter((a) => a.group === 'asset');
  const liabilities = accounts.filter((a) => a.group === 'liability');
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} {...props}>
      {(placeholder || !value) && <option value="">Pilih akun…</option>}
      {assets.length > 0 && (
        <optgroup label="Aset / kas">
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </optgroup>
      )}
      {liabilities.length > 0 && (
        <optgroup label="Utang">
          {liabilities.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </optgroup>
      )}
    </Select>
  );
}
