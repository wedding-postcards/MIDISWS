/** Public assets loaded at runtime are not rewritten by Vite automatically. */
export function assetUrl(path: string): string {
  return new URL(`${import.meta.env.BASE_URL}${path}`, document.baseURI).href;
}
