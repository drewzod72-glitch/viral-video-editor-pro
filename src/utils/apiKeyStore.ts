/**
 * Stores the user's own Groq API key locally on their device.
 *
 * This is the "bring your own key" model: nothing is sent to or stored on
 * any server operated by this app. The key lives only in the browser's
 * localStorage (or, inside a Capacitor-wrapped native app, you can swap
 * this for @capacitor/preferences — see the note below — for storage that
 * survives the app being reinstalled and isn't wiped by iOS/Android
 * clearing website data).
 *
 * SECURITY NOTE (be upfront with users about this): localStorage is not
 * encrypted and is readable by any script running on the same origin, or
 * by anyone with physical access to the device using dev tools. It is
 * appropriate for a personal API key the user controls, in the same way
 * many "BYOK" tools work — but it is not a secrets vault. Do not extend
 * this pattern to store anything more sensitive.
 *
 * CAPACITOR UPGRADE PATH: for a native build, replace the localStorage
 * calls below with @capacitor/preferences (`npm install
 * @capacitor/preferences`), which persists to the OS-level app sandbox
 * instead of the WebView's storage:
 *
 *   import { Preferences } from '@capacitor/preferences';
 *   await Preferences.set({ key: STORAGE_KEY, value });
 *   const { value } = await Preferences.get({ key: STORAGE_KEY });
 *   await Preferences.remove({ key: STORAGE_KEY });
 */

const STORAGE_KEY = 'avve.groq_api_key';

/**
 * Cleans up a pasted API key before validating or storing it.
 *
 * A real API key never legitimately contains whitespace, so rather than
 * just trim() the edges and reject anything else, this actively strips:
 *  - zero-width characters (U+200B/200C/200D/FEFF) — invisible, but real,
 *    and a common artifact of copying text out of some mobile UIs
 *  - non-breaking spaces (U+00A0) — often inserted where a key wraps
 *    across a line on a narrow mobile screen
 *  - ALL whitespace anywhere in the string, not just the ends — a
 *    line-wrapped key selected by double-tap-and-drag on a phone can
 *    easily pick up a newline or space in the middle, which a plain
 *    .trim() would never catch
 */
export function sanitizeApiKeyInput(raw: string): string {
  return raw
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, '')
    .replace(/\s+/g, '');
}

export function getStoredApiKey(): string | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value && value.trim() ? value.trim() : null;
  } catch {
    // localStorage can throw in some privacy modes / sandboxed iframes.
    return null;
  }
}

export function setStoredApiKey(key: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, sanitizeApiKeyInput(key));
  } catch (err) {
    console.error('[API Key Store] Could not persist key to localStorage:', err);
  }
}

export function clearStoredApiKey(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('[API Key Store] Could not clear key from localStorage:', err);
  }
}

/** Very loose shape check — Groq keys typically start with "gsk_" followed by a string of characters. */
export function looksLikeValidAiKey(key: string): boolean {
  return /^gsk_[A-Za-z0-9]{20,}$/.test(key);
}
