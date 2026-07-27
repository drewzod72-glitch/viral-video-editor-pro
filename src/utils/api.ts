/**
 * Resolves the API base URL for the backend.
 *
 * Previously this guessed whether the app was running as a native mobile
 * wrapper by sniffing window.location.hostname/port combinations (e.g.
 * "port !== '3000' && port !== '5173'"). That heuristic silently breaks
 * on any hosting setup it wasn't written for — a different dev port, a
 * new deploy target, a QA tester opening the preview URL directly — and
 * a wrong guess here means every render/copilot/download request goes to
 * the wrong origin with no visible error, just failed requests.
 *
 * Instead, the API base is set explicitly at build time per target:
 *   - Web build:        VITE_API_BASE_URL=""  (same-origin, relative paths)
 *   - Capacitor build:  VITE_API_BASE_URL="https://your-production-domain"
 *
 * Set this in the appropriate .env file (e.g. .env.production,
 * .env.capacitor) rather than editing this function.
 */
export const getApiBase = (): string => {
  const configured = import.meta.env.VITE_API_BASE_URL;
  return typeof configured === 'string' ? configured : '';
};
