/**
 * M2 acceptance — actor evidence. Frozen invariants:
 *  - funding graph correctness (common parent, fan-out, span)
 *  - coordinated activity detection (same mint, slot window)
 *  - every emitted record passes the M0 evidence contract
 *  - Cluster ≠ Risk: outputs carry no risk score / verdict field
 *  - gate eligibility is input-only mapping — related-wallets, never written
 */
import { describe, expect, it } from 'vitest';
import { gateEligibility } from '@/lib/evidence/contract';
import { buildActorEvidence, buildFundingGraph, detectCoordinatedActivity, freshWallets, type FundingTransferObs, type TokenBuyObs } from './evidence';

const PARENT = 'FunderX1111111111111111111111111111111111';
const WALLET_A = 'WalletA1111111111111111111111111111111111';
const WALLET_B = 'WalletB1111111111111111111111111111111111';
const WALLET_C = 'WalletC1111111111111111111111111111111111';
const MINT = 'PumpMint111111111111111111111111111111111';

const transfers: FundingTransferObs[] = [
  { from: PARENT, to: WALLET_A, slot: 1001, lamports: 5_000_000_000, signature: 'sig-a1' },
  { from: PARENT, to: WALLET_B, slot: 1002, lamports: 5_000_000_000, signature: 'sig-b1' },
  { from: PARENT, to: WALLET_C, slot: 1003, lamports: 5_000_000_000, signature: 'sig-c1' },
  { from: 'OtherParent11111111111111111111111111111111', to: WALLET_C, slot: 1040, lamports: 1_000_000_000, signature: 'sig-c2' },
];

const buys: TokenBuyObs[] = [
  { wallet: WALLET_A, mint: MINT, slot: 1010, signature: 'buy-a' },
  { wallet: WALLET_B, mint: MINT, slot: 1011, signature: 'buy-b' },
  { wallet: WALLET_C, mint: MINT, slot: 1012, signature: 'buy-c' },
  { wallet: 'Unrelated1111111111111111111111111111111111', mint: 'OtherMint11111111111111111111111111111111', slot: 1011, signature: 'buy-x' },
];

describe('M2 funding graph', () => {
  it('detects the common-parent cluster with fan-out 3', () => {
    const { relations, clusters } = buildFundingGraph(transfers);
    expect(relations).toHaveLength(4);
    const main = clusters.find((c) => c.parentWallet === PARENT);
    expect(main).toBeDefined();
    expect(main!.children).toEqual([WALLET_A, WALLET_B, WALLET_C].sort());
    expect(main!.fanOutCount).toBe(3);
    expect(main!.fundingSpanSlots).toBe(2);
    expect(clusters.find((c) => c.parentWallet === 'OtherParent11111111111111111111111111111111')).toBeUndefined();
  });

  it('detects coordinated same-mint buying in a slot window', () => {
    const activity = detectCoordinatedActivity(buys, 30);
    expect(activity).not.toBeNull();
    expect(activity!.mint).toBe(MINT);
    expect(activity!.wallets).toEqual([WALLET_A, WALLET_B, WALLET_C].sort());
  });

  it('flags fresh wallets by tx-count threshold only', () => {
    const fresh = freshWallets([{ wallet: WALLET_A, txCount: 2 }, { wallet: WALLET_C, txCount: 50 }], 3);
    expect(fresh.map((f) => f.wallet)).toEqual([WALLET_A]);
  });
});

describe('M2 evidence emission', () => {
  it('emits contract-valid records: funding-relation, coordinated-activity, fresh-wallet, early-buyer', async () => {
    const records = await buildActorEvidence({
      transfers,
      buys,
      walletActivity: [{ wallet: WALLET_A, txCount: 2 }, { wallet: WALLET_C, txCount: 50 }],
      births: [{ mint: MINT, slot: 1001 }],
      observedAt: '2026-09-04T00:10:00.000Z',
    });
    const types = records.map((r) => r.factType).sort();
    expect(types).toEqual(['coordinated-activity', 'early-buyer', 'early-buyer', 'early-buyer', 'fresh-wallet', 'funding-relation']);
    // Every record already passed assertEvidence inside the builder.
    expect(records.every((r) => r.cap === 'CAP-03-ACTOR')).toBe(true);
  });

  it('Cluster ≠ Risk: no emitted value carries a risk score or verdict', async () => {
    const records = await buildActorEvidence({
      transfers,
      buys,
      walletActivity: [{ wallet: WALLET_A, txCount: 2 }],
      births: [{ mint: MINT, slot: 1001 }],
      observedAt: '2026-09-04T00:10:00.000Z',
    });
    for (const r of records) {
      expect(JSON.stringify(r.value)).not.toMatch(/risk|verdict|score|insider|cabal/i);
    }
  });

  it('actor facts are gate INPUTS for related-wallets only — never a gate write', () => {
    expect(gateEligibility('funding-relation')).toEqual(['related-wallets']);
    expect(gateEligibility('coordinated-activity')).toEqual(['related-wallets']);
    expect(gateEligibility('fresh-wallet')).toEqual(['related-wallets']);
    expect(gateEligibility('early-buyer')).toEqual(['related-wallets']);
  });
});
