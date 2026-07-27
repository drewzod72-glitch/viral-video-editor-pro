/**
 * Cross-platform "save this file to the user's device" helper.
 *
 * Why this exists: a plain `<a download>` click on a blob: URL is the
 * one pattern that reliably works everywhere EXCEPT it still leaves iOS
 * users without a real "Save to Photos/Files" option — Safari just opens
 * the video for viewing. navigator.share with a File gives iOS/Android
 * *browser* users the native share sheet, which includes "Save Video" /
 * "Save to Files".
 *
 * IMPORTANT CAPACITOR NOTE: navigator.share often does NOT behave the
 * same, or isn't available at all, inside a Capacitor-wrapped native
 * WebView — this varies by platform/version and isn't something to rely
 * on there. Once this app is built with Capacitor, this function
 * detects that (via @capacitor/core's Capacitor.isNativePlatform()) and
 * uses @capacitor/filesystem + @capacitor/share instead: write the file
 * into the app's cache directory, then hand that file off to the native
 * share sheet. That's the standard, documented pattern for this exact
 * "save a generated file" use case in a Capacitor app.
 *
 * Priority order:
 *   1. Native (Capacitor) -> Filesystem.writeFile + Share.share
 *   2. Browser with Web Share API + file support -> navigator.share
 *   3. Everywhere else -> blob URL + anchor download
 *
 * IMPORTANT: only call this from a real user click handler (a button's
 * onClick, or an <a>'s onClick before preventDefault). Share APIs and
 * the anchor download pattern both require a user gesture — calling
 * this from a .then() after unrelated async work, with no click in
 * between, will silently fail on several platforms.
 */

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // reader.result is a data: URL ("data:<mime>;base64,<data>") — strip the prefix.
      const base64 = result.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function saveViaCapacitor(blob: Blob, filename: string): Promise<boolean> {
  try {
    // Dynamic imports: these packages are only meaningful in a native
    // build. Dynamic import keeps them out of the critical path (and
    // avoids any issue if they're ever not installed) while still
    // letting Vite bundle them for the Capacitor build.
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

export async function saveFileToDevice(blob: Blob, filename: string): Promise<void> {
  if (await saveViaCapacitor(blob, filename)) return;

  const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });

  if (typeof navigator !== 'undefined' && (navigator as any).canShare?.({ files: [file] })) {
    try {
      await (navigator as any).share({ files: [file], title: filename });
      return;
    } catch (err) {
      // User cancelled the share sheet, or the platform rejected it for
      // some other reason — fall through to the anchor-click download.
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Give the browser a moment to actually start the download before revoking.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
  }
}

/** Convenience wrapper when you only have a URL (e.g. an already-created object URL) rather than a Blob. */
export async function saveUrlToDevice(url: string, filename: string): Promise<void> {
  const blob = await (await fetch(url)).blob();
  await saveFileToDevice(blob, filename);
}

