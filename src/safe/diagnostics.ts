// Mencatat error terakhir di perangkat agar bisa ditampilkan di layar error / Mode aman.
// Hanya pesan teknis (tanpa data keuangan) yang disimpan, dan hanya di perangkat ini.

const KEY = 'keuangan:lastError';

export interface RecordedError {
  at: string;
  message: string;
  version: string;
}

export function recordError(error: unknown): void {
  try {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    const entry: RecordedError = { at: new Date().toISOString(), message: message.slice(0, 500), version: __APP_VERSION__ };
    localStorage.setItem(KEY, JSON.stringify(entry));
  } catch {
    // localStorage bisa tidak tersedia; diagnosis bersifat opsional.
  }
}

export function lastRecordedError(): RecordedError | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RecordedError) : null;
  } catch {
    return null;
  }
}

export function installErrorRecorder(): void {
  window.addEventListener('error', (e) => recordError(e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => recordError(e.reason));
}

export const SAFE_MODE_URL = './?aman=1';

export function isSafeMode(): boolean {
  return new URLSearchParams(window.location.search).has('aman');
}
