/**
 * M3 Token / Program Evidence — raw inspection only.
 * Byte-level SPL mint decode + Token-2022 TLV extension presence scan +
 * ProgramData upgrade-authority decode, adapted from
 * solana-rugcheck-skill (MIT, ZachFB et al.) per Acquisition Matrix V1
 * grade A: raw inspection absorbed, its doc-level scoring rubric NOT absorbed.
 * Pure functions over account BYTES — no RPC, no network, no wallet.
 */
import { b58encode } from '@/lib/data/base58';
import type { EvidenceRecord } from '@/lib/evidence/contract';
import { EVIDENCE_CONTRACT_VERSION, assertEvidence } from '@/lib/evidence/contract';
import { sha256hex } from '@/lib/data/hash';

export const TOKEN_RISK_ENGINE_VERSION = 'star-tokenrisk@1';
export const TOKEN_RISK_SOURCE = 'synthetic-fixtures';
export const TOKEN_RISK_ADAPTER = 'token-raw-inspection';

// ── SPL Mint layout (Token & Token-2022 share the first 82 bytes) ──
//   0     u32   mintAuthorityOption
//   4..36 pubkey mintAuthority (option == 1)
//   36    u64   supply
//   44    u8    decimals
//   45    u8    isInitialized
//   46    u32   freezeAuthorityOption
//   50..82 pubkey freezeAuthority (option == 1)
//   >82   Token-2022: account-type marker byte, then TLV extensions.

export interface MintAccountState {
  mintAuthority: string | null;
  freezeAuthority: string | null;
  supply: string;
  decimals: number;
  isInitialized: boolean;
  extensions: Token2022Extension[];
}

export interface Token2022Extension {
  type: number;
  name: string;
}

/** Known TLV type codes (spl-token-2022, stable per program v1/v2). Presence only. */
const EXTENSION_NAMES: Record<number, string> = {
  1: 'TransferFeeConfig',
  3: 'MintCloseAuthority',
  7: 'PermanentDelegate',
  9: 'NonTransferable',
  14: 'DefaultAccountState',
  18: 'TransferHook',
};

export function decodeMintAccount(data: Uint8Array): MintAccountState {
  if (data.length < 82) throw new Error(`account data too short for a mint (${data.length} bytes)`);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const mintAuthorityOption = view.getUint32(0, true);
  const mintAuthority = mintAuthorityOption === 1 ? b58encode(data.subarray(4, 36)) : null;
  // u64 supply kept as string — may exceed Number.MAX_SAFE_INTEGER.
  const supply = view.getBigUint64(36, true).toString();
  const decimals = view.getUint8(44);
  const isInitialized = view.getUint8(45) === 1;
  const freezeAuthorityOption = view.getUint32(46, true);
  const freezeAuthority = freezeAuthorityOption === 1 ? b58encode(data.subarray(50, 82)) : null;
  return { mintAuthority, freezeAuthority, supply, decimals, isInitialized, extensions: scanToken2022Extensions(data) };
}

/**
 * Token-2022 TLV scanner: sequence of (type u16 LE, length u16 LE, value).
 * Identifies PRESENCE of known codes only — no per-extension deserialization
 * (same honest limit as the source project).
 */
export function scanToken2022Extensions(data: Uint8Array): Token2022Extension[] {
  const found: Token2022Extension[] = [];
  if (data.length <= 82) return found;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 83; // skip account-type marker at 82
  while (offset + 4 <= data.length) {
    const extType = view.getUint16(offset, true);
    const extLen = view.getUint16(offset + 2, true);
    if (extType === 0) break; // padding / end marker
    found.push({ type: extType, name: EXTENSION_NAMES[extType] ?? `Unknown(${extType})` });
    offset += 4 + extLen;
    if (offset > data.length) break; // malformed guard
  }
  return found;
}

/** ProgramData layout: discriminator u32 + deploy slot u64 + Option<Pubkey> upgrade authority. */
export function decodeProgramData(data: Uint8Array): { deploySlot: string; upgradeAuthority: string | null } {
  if (data.length < 16) throw new Error(`program data too short (${data.length} bytes)`);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const deploySlot = view.getBigUint64(4, true).toString();
  const option = view.getUint32(12, true);
  const upgradeAuthority = option === 1 && data.length >= 16 + 32 ? b58encode(data.subarray(16, 48)) : null;
  return { deploySlot, upgradeAuthority };
}

// ── Evidence emission (M0 contract; raw facts only, never verdicts) ──

let seq = 0;

export interface TokenProgramEvidenceInput {
  mint: string;
  mintAccountBytes: Uint8Array;
  programDataBytes?: Uint8Array;
  programId?: string;
  observedAt: string;
  slot: number;
}

export async function buildTokenProgramEvidence(input: TokenProgramEvidenceInput): Promise<EvidenceRecord[]> {
  const state = decodeMintAccount(input.mintAccountBytes);
  const records: EvidenceRecord[] = [];

  const base: Omit<EvidenceRecord, 'evidenceId' | 'factType' | 'value'> = {
    contractVersion: EVIDENCE_CONTRACT_VERSION,
    cap: 'CAP-04-TOKEN-PROGRAM' as const,
    source: TOKEN_RISK_SOURCE,
    adapter: TOKEN_RISK_ADAPTER,
    sourceVersion: TOKEN_RISK_ENGINE_VERSION,
    entityType: 'asset' as const,
    entityId: input.mint,
    observedAt: input.observedAt,
    slot: input.slot,
    txSignatures: [],
    confidence: null,
    provenance: { method: 'byte-decode:getAccountInfo', rawRef: await sha256hex(String.fromCharCode(...input.mintAccountBytes)) },
  };

  records.push({ ...base, evidenceId: `ev-tr-${++seq}-mint`, factType: 'mint-authority-state', value: { mintAuthority: state.mintAuthority, decimals: state.decimals, supply: state.supply } });
  records.push({ ...base, evidenceId: `ev-tr-${++seq}-freeze`, factType: 'freeze-authority-state', value: { freezeAuthority: state.freezeAuthority } });
  records.push({ ...base, evidenceId: `ev-tr-${++seq}-ext`, factType: 'token-2022-extensions', value: { extensions: state.extensions.map((e) => e.name), unknownTypes: state.extensions.filter((e) => e.name.startsWith('Unknown')).map((e) => e.type) } });

  if (input.programDataBytes && input.programId) {
    const program = decodeProgramData(input.programDataBytes);
    records.push({
      ...base,
      evidenceId: `ev-tr-${++seq}-upgrade`,
      entityType: 'program',
      entityId: input.programId,
      factType: 'program-upgrade-authority',
      value: { upgradeAuthority: program.upgradeAuthority, deploySlot: program.deploySlot, programId: input.programId },
      provenance: { method: 'byte-decode:program-data' },
    });
  }

  for (const r of records) assertEvidence(r);
  return records;
}

// ── Fixture byte builders (synthetic mint/program accounts) ──

export function fixtureMintBytes(opts?: { mintAuthority?: Uint8Array | null; freezeAuthority?: Uint8Array | null; decimals?: number; extensions?: Array<[number, Uint8Array]> }): Uint8Array {
  const base = new Uint8Array(82);
  const view = new DataView(base.buffer);
  if (opts?.mintAuthority) {
    view.setUint32(0, 1, true);
    base.set(opts.mintAuthority, 4);
  }
  view.setBigUint64(36, 1_000_000n, true);
  view.setUint8(44, opts?.decimals ?? 6);
  view.setUint8(45, 1);
  if (opts?.freezeAuthority) {
    view.setUint32(46, 1, true);
    base.set(opts.freezeAuthority, 50);
  }
  if (!opts?.extensions?.length) return base;
  const chunks: Uint8Array[] = [base, new Uint8Array([1])]; // account-type marker: Mint
  for (const [type, value] of opts.extensions) {
    const head = new Uint8Array(4);
    new DataView(head.buffer).setUint16(0, type, true);
    new DataView(head.buffer).setUint16(2, value.length, true);
    chunks.push(head, value);
  }
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return out;
}

export function fixtureProgramDataBytes(upgradeAuthority: Uint8Array | null): Uint8Array {
  const data = new Uint8Array(48);
  const view = new DataView(data.buffer);
  view.setUint32(0, 3, true);
  view.setBigUint64(4, 250_000n, true);
  if (upgradeAuthority) {
    view.setUint32(12, 1, true);
    data.set(upgradeAuthority, 16);
  }
  return data;
}
