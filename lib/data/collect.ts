/* eslint-disable @typescript-eslint/no-explicit-any -- untrusted external JSON is parsed defensively at this boundary */
/**
 * Collector: pulls facts from a read-only provider, validates each against the
 * frozen contract, records evidence rows (observedAt = provider observation,
 * ingestedAt = collector wall clock), refreshes denormalized cache and
 * re-runs the six gates. No wallet, no transaction, no state change on-chain.
 */
import { createHash } from 'crypto';
import { eq } from 'drizzle-orm';
import type { StarDb } from '@/lib/db';
import * as s from '@/db/schema';
import { assertFact, type ChainFact, type ReadonlyChainProvider } from './contract';
import { refreshProject } from '@/lib/engine';

export interface FactReport {
  kind: string;
  ok: boolean;
  observedAt: string;
  source: string;
  detail: string;
}

export interface CollectReport {
  projectId: string;
  provider: string;
  facts: FactReport[];
  gates: { gate: string; status: string; reason: string }[];
  score: { total: number } | null;
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Upsert the tokens/pools display cache from freshly collected facts. */
async function updateCache(db: StarDb, projectId: string, facts: ChainFact[]) {
  const [tokenFact] = facts.filter((f) => f.kind === 'mint-authority');
  if (tokenFact) {
    const p = tokenFact.payload as any;
    const existing = await db.select().from(s.tokens).where(eq(s.tokens.projectId, projectId));
    const values = {
      projectId,
      mintAuthority: p.mintAuthority ?? null,
      freezeAuthority: p.freezeAuthority ?? null,
      transferHook: p.transferHook ?? null,
      permanentDelegate: p.permanentDelegate ?? null,
      feeConfig: p.feeConfig ?? null,
      verifiedBuild: null,
      upgradeAuthority: null,
    };
    if (existing.length) await db.update(s.tokens).set(values).where(eq(s.tokens.projectId, projectId));
    else await db.insert(s.tokens).values({ id: `tok-${projectId}`, ...values });
  }
  const liqFact = facts.find((f) => f.kind === 'liquidity');
  if (liqFact && (liqFact.payload as any).pools?.length) {
    const pool = (liqFact.payload as any).pools[0];
    const existing = await db.select().from(s.pools).where(eq(s.pools.projectId, projectId));
    const values = {
      projectId, dex: pool.dex, pair: pool.pair, tvlUsd: pool.tvlUsd ?? null,
      lockInfo: { lpBurnedPct: pool.lpBurnedPct ?? null, lockedUntil: pool.lockedUntil ?? null },
    };
    if (existing.length) await db.update(s.pools).set(values).where(eq(s.pools.projectId, projectId));
    else await db.insert(s.pools).values({ id: `pool-${projectId}`, ...values });
  }
}

export async function collectProject(db: StarDb, projectId: string, provider: ReadonlyChainProvider): Promise<CollectReport> {
  const [project] = await db.select().from(s.projects).where(eq(s.projects.id, projectId));
  if (!project) throw new Error(`unknown project ${projectId}`);
  const mint = project.tokenMint;
  if (!mint) throw new Error(`project ${projectId} has no token mint`);

  const attempts: { kind: string; run: () => Promise<ChainFact> }[] = [
    { kind: 'mint-authority', run: () => provider.mintAuthorities(mint) },
    { kind: 'holder-distribution', run: () => provider.holderDistribution(mint) },
    { kind: 'liquidity', run: () => provider.liquidity(mint) },
    { kind: 'sell-simulation', run: () => provider.sellSimulation(mint) },
    { kind: 'related-wallets', run: () => provider.relatedWallets(mint) },
    { kind: 'program-verification', run: () => provider.programVerification(mint, project.programId) },
  ];

  const ingestedAt = new Date();
  const facts: ChainFact[] = [];
  const reports: FactReport[] = [];
  for (const { kind, run } of attempts) {
    try {
      const fact = assertFact(await run());
      facts.push(fact);
      await db.insert(s.evidence).values({
        projectId,
        type: fact.kind,
        observedAt: new Date(fact.observedAt),
        effectiveAt: new Date(fact.observedAt),
        ingestedAt,
        source: fact.source,
        sourceUrl: fact.sourceUrl ?? '',
        hash: sha256(JSON.stringify(fact.payload)),
        payload: fact.payload as any,
        conclusion: `${fact.kind} @ slot ${fact.slot ?? 'n/a'} (${fact.source})`,
        conflictWith: null,
      });
      reports.push({ kind, ok: true, observedAt: fact.observedAt, source: fact.source, detail: 'ingested' });
    } catch (e: unknown) {
      reports.push({ kind, ok: false, observedAt: ingestedAt.toISOString(), source: provider.id, detail: e instanceof Error ? e.message : String(e) });
    }
  }

  // freeze-authority comes from the same mint decode as mint-authority
  const mintFact = facts.find((f) => f.kind === 'mint-authority');
  if (mintFact) {
    await db.insert(s.evidence).values({
      projectId,
      type: 'freeze-authority',
      observedAt: new Date(mintFact.observedAt),
      effectiveAt: new Date(mintFact.observedAt),
      ingestedAt,
      source: mintFact.source,
      sourceUrl: mintFact.sourceUrl ?? '',
      hash: sha256(JSON.stringify({ freeze: mintFact.payload })),
      payload: mintFact.payload as any,
      conclusion: `freeze-authority @ slot ${mintFact.slot ?? 'n/a'} (${mintFact.source})`,
      conflictWith: null,
    });
    reports.push({ kind: 'freeze-authority', ok: true, observedAt: mintFact.observedAt, source: mintFact.source, detail: 'ingested (mint decode)' });
  }

  await updateCache(db, projectId, facts);
  const evaluation = await refreshProject(db, projectId);

  return {
    projectId,
    provider: provider.id,
    facts: reports,
    gates: evaluation.gates.map((g) => ({ gate: g.gate, status: g.status, reason: g.reason })),
    score: evaluation.score ? { total: evaluation.score.total } : null,
  };
}
