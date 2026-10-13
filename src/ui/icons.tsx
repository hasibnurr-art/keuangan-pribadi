// Satu keluarga ikon (Phosphor, gaya "regular" 1.5px; "fill" hanya untuk status aktif).
// Impor per ikon agar bundle & tes tidak memuat ribuan ikon. Emoji hanya dipakai untuk
// konten pilihan pengguna (ikon kategori/target), tidak untuk ikon sistem.

import type { IconProps } from '@phosphor-icons/react/dist/lib/types';
import { ArrowsLeftRight } from '@phosphor-icons/react/dist/csr/ArrowsLeftRight';
import { Bank } from '@phosphor-icons/react/dist/csr/Bank';
import { CaretDown } from '@phosphor-icons/react/dist/csr/CaretDown';
import { CaretLeft } from '@phosphor-icons/react/dist/csr/CaretLeft';
import { CaretRight } from '@phosphor-icons/react/dist/csr/CaretRight';
import { CaretUp } from '@phosphor-icons/react/dist/csr/CaretUp';
import { ChartBar } from '@phosphor-icons/react/dist/csr/ChartBar';
import { ChartPieSlice } from '@phosphor-icons/react/dist/csr/ChartPieSlice';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { Coins } from '@phosphor-icons/react/dist/csr/Coins';
import { CreditCard } from '@phosphor-icons/react/dist/csr/CreditCard';
import { DeviceMobile } from '@phosphor-icons/react/dist/csr/DeviceMobile';
import { DotsThreeOutline } from '@phosphor-icons/react/dist/csr/DotsThreeOutline';
import { Eye } from '@phosphor-icons/react/dist/csr/Eye';
import { EyeSlash } from '@phosphor-icons/react/dist/csr/EyeSlash';
import { FloppyDisk } from '@phosphor-icons/react/dist/csr/FloppyDisk';
import { FunnelSimple } from '@phosphor-icons/react/dist/csr/FunnelSimple';
import { Gear } from '@phosphor-icons/react/dist/csr/Gear';
import { HandCoins } from '@phosphor-icons/react/dist/csr/HandCoins';
import { House } from '@phosphor-icons/react/dist/csr/House';
import { Invoice } from '@phosphor-icons/react/dist/csr/Invoice';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { Minus } from '@phosphor-icons/react/dist/csr/Minus';
import { Money } from '@phosphor-icons/react/dist/csr/Money';
import { Notepad } from '@phosphor-icons/react/dist/csr/Notepad';
import { PencilSimple } from '@phosphor-icons/react/dist/csr/PencilSimple';
import { PiggyBank } from '@phosphor-icons/react/dist/csr/PiggyBank';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { Receipt } from '@phosphor-icons/react/dist/csr/Receipt';
import { Scales } from '@phosphor-icons/react/dist/csr/Scales';
import { Tag } from '@phosphor-icons/react/dist/csr/Tag';
import { Target } from '@phosphor-icons/react/dist/csr/Target';
import { TrendUp } from '@phosphor-icons/react/dist/csr/TrendUp';
import { Wallet } from '@phosphor-icons/react/dist/csr/Wallet';
import { Warning } from '@phosphor-icons/react/dist/csr/Warning';
import { X } from '@phosphor-icons/react/dist/csr/X';
import type { ComponentType } from 'react';
import type { AccountKind } from '../domain/types';

export type Icon = ComponentType<IconProps>;

/** Token ukuran ikon (px). */
export const ICON = { xs: 12, sm: 16, md: 20, lg: 24, xl: 32 } as const;

export {
  ArrowsLeftRight,
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  ChartBar,
  ChartPieSlice,
  CreditCard,
  Check,
  DotsThreeOutline,
  Eye,
  EyeSlash,
  FloppyDisk,
  FunnelSimple,
  Gear,
  House,
  Invoice,
  MagnifyingGlass,
  Minus,
  Notepad,
  PencilSimple,
  PiggyBank,
  Plus,
  Receipt,
  Scales,
  Tag,
  Target,
  TrendUp,
  Wallet,
  Warning,
  X,
};

export const ACCOUNT_KIND_ICONS: Record<AccountKind, Icon> = {
  bank: Bank,
  cash: Money,
  ewallet: DeviceMobile,
  other_asset: Coins,
  credit_card: CreditCard,
  paylater: Invoice,
  loan: HandCoins,
  other_liability: Notepad,
};

/** Lingkaran ikon jenis akun (dekoratif; nama akun selalu tampil di sebelahnya). */
export function AccountKindBadge({ kind, size = 'md' }: { kind: AccountKind; size?: 'md' | 'lg' }) {
  const KindIcon = ACCOUNT_KIND_ICONS[kind];
  return (
    <span
      aria-hidden
      className={
        size === 'lg'
          ? 'flex size-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700'
          : 'flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700'
      }
    >
      <KindIcon size={size === 'lg' ? ICON.lg : ICON.md} />
    </span>
  );
}
