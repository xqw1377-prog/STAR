import { canonicalize } from './jcs';
import { sha256hex } from './hash';

/** Deterministic parser replay: same bytes + version ⇒ same payload_hash. */
export async function replayParse(bytes: string, parserVersion = 'parser@1'): Promise<{ payload: unknown; payloadHash: string; parserVersion: string }> {
  const payload = JSON.parse(bytes) as unknown;
  const payloadHash = await sha256hex(`${parserVersion}|${canonicalize(payload)}`);
  return { payload, payloadHash, parserVersion };
}
