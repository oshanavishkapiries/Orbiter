export async function register() {
  // Node.js 22+ may define a broken `localStorage` when `--localstorage-file`
  // is set without a valid path. This causes SSR errors in Next.js client components.
  // Undefine it so libraries fall back to their SSR-safe code paths.
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.getItem('__probe__');
    } catch {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (globalThis as any).localStorage;
      } catch {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).localStorage = undefined;
      }
    }
  }
}
