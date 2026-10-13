// Mengirim file ke pengguna: menu Bagikan di HP (simpan ke Drive/WhatsApp/email),
// unduhan biasa di laptop.

export type DeliveryResult = 'shared' | 'downloaded' | 'cancelled';

function prefersShareSheet(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
}

export async function deliverFile(text: string, filename: string, mime: string): Promise<DeliveryResult> {
  const file = new File([text], filename, { type: mime });
  if (prefersShareSheet() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // Share gagal karena alasan lain → jatuh ke unduhan biasa.
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}
