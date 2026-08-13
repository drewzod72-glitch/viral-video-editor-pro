/**
 * Cross-platform "save this file to the user's device" helper.
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

    await Share.share({ title: filename, url: written.uri });
    return true;
  } catch (err) {
    console.error('[Download] Native Capacitor save failed:', err);
    return false;
  }
}

export async function saveFileToDevice(blob: Blob, filename: string): Promise<void> {
  if (await saveViaCapacitor(blob, filename)) return;

  const file = new File([blob], filename, { type: blob.type || (filename.endsWith('.mp4') ? 'video/mp4' : 'video/webm') });

  // 1. Try Web Share API (Remove canShare gate per Kilo Fix)
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.warn('[Download] Share failed, trying anchor fallback:', err);
    }
  }

  // 2. iOS Safari Branch (Kilo Fix)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const objectUrl = URL.createObjectURL(blob);
  
  try {
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    
    if (isIOS) {
      // iOS fallback: Open in new tab if programmatic click is blocked/ignored
      setTimeout(() => {
        window.open(objectUrl, '_blank');
      }, 500);
    }
    
    document.body.removeChild(a);
  } finally {
    // 3. Extended Revoke Timeout (60s per Kilo Fix)
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
  }
}

export async function saveUrlToDevice(url: string, filename: string): Promise<void> {
  const blob = await (await fetch(url)).blob();
  await saveFileToDevice(blob, filename);
}
