/* eslint-disable @typescript-eslint/no-explicit-any -- untrusted external JSON is parsed defensively at this boundary */
/** Fixture provider: serves the latest state of the synthetic timeline. Read-only by construction. */
import { CONTRACT_VERSION, type ChainFact, type ReadonlyChainProvider } from './contract';
import { currentFacts, FIXTURE_PROJECTS } from './star-fixture';

function latest(projectId: string, kind: ChainFact['kind']): ChainFact<any> {
  const facts = currentFacts(new Date(), projectId).filter((f) => f.kind === kind);
  if (!facts.length) throw new Error(`fixture: no ${kind} fact for ${projectId}`);
  return facts[0];
}

export function createFixtureProvider(projectId: string): ReadonlyChainProvider {
  const project = FIXTURE_PROJECTS.find((p) => p.projectId === projectId);
  if (!project) throw new Error(`fixture: unknown project ${projectId}`);
  return {
    id: 'fixture',
    contractVersion: CONTRACT_VERSION,
    async mintAuthorities() {
      return latest(projectId, 'mint-authority');
    },
    async holderDistribution() {
      return latest(projectId, 'holder-distribution');
    },
    async liquidity() {
      return latest(projectId, 'liquidity');
    },
    async sellSimulation() {
      return latest(projectId, 'sell-simulation');
    },
    async relatedWallets() {
      return latest(projectId, 'related-wallets');
    },
    async programVerification() {
      return latest(projectId, 'program-verification');
    },
  };
}
