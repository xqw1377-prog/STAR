/* eslint-disable @typescript-eslint/no-explicit-any -- untrusted external JSON is parsed defensively at this boundary */
/**
 * Collector: pulls facts from a read-only provider, validates each against the
 * frozen contract, records evidence rows (observedAt = provider observation,
 * ingestedAt = collector wall clock), refreshes denormalized cache and
 * re-runs the six gates. No wallet, no transaction, no state change on-chain.
 */
import { eq } from 'drizzle-orm';
import type { StarDb } from '@/lib/db';
import * as s from '@/db/schema';
import { assertFact, type ChainFact, type ReadonlyChainProvider } from './contract';
import { refreshProject } from '@/lib/engine';
import { completeFailure, completeSuccess, ensurePlanItem, startAttempt } from './ledger';

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

  const facts: ChainFact[] = [];
  const reports: FactReport[] = [];
  for (const { kind, run } of attempts) {
    const planItemId = await ensurePlanItem(db, {
      sourceId: provider.id,
      methodId: kind,
      projectId,
      factKind: kind,
    });
    const started = await startAttempt(db, {
      projectId,
      factKind: kind,
      sourceId: provider.id,
      methodId: kind,
      planItemId,
      requestParams: { projectId, factKind: kind },
    });
    try {
      const fact = assertFact(await run());
      facts.push(fact);
      const extra = fact.kind === 'mint-authority'
        ? [{
            kind: 'freeze-authority',
            payload: fact.payload,
            conclusion: `freeze-authority @ slot ${fact.slot ?? 'n/a'} (${fact.source})`,
          }]
        : [];
      if (extra.length) {
        await ensurePlanItem(db, {
          sourceId: provider.id,
          methodId: 'freeze-authority',
          projectId,
          factKind: 'freeze-authority',
        });
      }
      await completeSuccess(db, {
        attemptId: started.attemptId,
        observationKey: started.observationKey,
        projectId,
        fact,
        extraFacts: extra,
      });
      reports.push({ kind, ok: true, observedAt: fact.observedAt, source: fact.source, detail: 'ingested' });
      if (extra.length) {
        reports.push({ kind: 'freeze-authority', ok: true, observedAt: fact.observedAt, source: fact.source, detail: 'ingested (mint decode)' });
      }
    } catch (e: unknown) {
      await completeFailure(db, { attemptId: started.attemptId, error: e });
      reports.push({ kind, ok: false, observedAt: new Date().toISOString(), source: provider.id, detail: e instanceof Error ? e.message : String(e) });
    }
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
