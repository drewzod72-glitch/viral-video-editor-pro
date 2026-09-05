/**
 * Cross-platform "save this file to the user's device" helper.
 *
 * Priority order:
 *   1. Native (Capacitor) -> Filesystem.writeFile + Share.share
 *   2. Browser with Web Share API -> navigator.share
 *   3. iOS Safari -> forced download via blob + custom filename
 *   4. Desktop/Android -> blob URL + anchor download
 */

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function saveViaCapacitor(blob: Blob, filename: string): Promise<boolean> {
  try {
    const [{ Capacitor }, { Filesystem, Directory }, { Share }] = await Promise.all([
      import('@capacitor/core'),
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ]);

    if (!Capacitor.isNativePlatform()) return false;

    const base64Data = await blobToBase64(blob);
    const written = await Filesystem.writeFile({
      path: filename,
      data: base64Data,
      directory: Directory.Cache,
    });

    await Share.share({
      title: filename,
      url: written.uri,
    });
    return true;
  } catch (err) {
    console.error('[Download] Native Capacitor save failed, falling back to web path:', err);
    return false;
  }
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent || '') ||
    (navigator.userAgent.includes('Mac') && 'ontouchend' in document);
}

export async function saveFileToDevice(blob: Blob, filename: string): Promise<void> {
  if (await saveViaCapacitor(blob, filename)) return;

  const mimeType = blob.type || 'application/octet-stream';
  const file = new File([blob], filename, { type: mimeType });

  // Try Web Share API directly — works on iOS (gives Save to Photos) and Android
  if (typeof navigator !== 'undefined' && (navigator as any).share) {
    try {
      await (navigator as any).share({
        files: [file],
        title: filename,
      });
      return;
    } catch (err: any) {
      // User cancelled or platform rejected — fall through to download fallback
      if (err?.name === 'AbortError') return;
      console.warn('[Download] Web Share failed, trying fallback:', err?.message);
    }
  }

  // iOS Safari: use blob URL with forced download attribute
  // Safari on iOS respects the download attribute more reliably than older methods
  const objectUrl = URL.createObjectURL(blob);

  try {
    if (isIOS()) {
      // iOS: create a temporary link and simulate a click
      // We keep the URL alive for 60 seconds because iOS is slow to start downloads
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      // Desktop / Android: standard anchor download
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  } finally {
    // Keep the URL alive long enough for the browser to start the download.
    // On iOS this can take 10-30 seconds.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
  }
}

/** Convenience wrapper when you only have a URL (e.g. an already-created object URL) rather than a Blob. */
export async function saveUrlToDevice(url: string, filename: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const blob = await (await fetch(url, { signal: controller.signal as any })).blob();
    await saveFileToDevice(blob, filename);
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}
