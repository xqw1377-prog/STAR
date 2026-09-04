/** Content-addressable SHA-256 via Web Crypto (Node 20+ and the browser). */
export async function sha256hex(text: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('SHA-256 requires Web Crypto');
  const buf = await subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function newLedgerId(prefix: string): string {
  const raw = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${raw}`;
}

export function blobScope(sourceId: string, retentionClass: string): string {
  return `${sourceId}|${retentionClass}`;
}

export async function blobKeyFor(scope: string, payloadHash: string): Promise<string> {
  return sha256hex(`${scope}|${payloadHash}`);
}
