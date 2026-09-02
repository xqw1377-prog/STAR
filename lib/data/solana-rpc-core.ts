/**
 * Solana read-only RPC provider — implementation core.
 *
 * This module performs network I/O and contains NO source-registry guard.
 * It must only be reached through:
 *   - lib/data/solana-rpc.ts          (guarded factory; app/runtime path)
 *   - lib/data/solana-rpc-smoke.ts    (engineering smoke path; tests only)
 *
 * Sources: JSON-RPC getAccountInfo/getTokenLargestAccounts/getTokenSupply/
 * getMultipleAccounts (public mainnet or STAR_RPC_URL), DexScreener token
 * pairs, Jupiter lite-api quote for the sell simulation. Every method is
 * strictly read-only: HTTP queries only, no keypairs, no sendTransaction,
 * no state mutation anywhere.
 */
import { CONTRACT_VERSION, type ChainFact, type ReadonlyChainProvider, type SellSimulationPayload } from './contract';
import {
  parseBuyQuote,
  parseDexScreener,
  parseHolderAccounts,
  parseJupiterQuote,
  parseMintAccount,
  parseProgramAccounts,
  standardSellSize,
} from './parsers';
import { b58encode } from './base58';

const WSOL = 'So11111111111111111111111111111111111111112';

function rpcUrl(): string {
  return process.env.STAR_RPC_URL || 'https://api.mainnet-beta.solana.com';
}
function rpcSource(): string {
  return `solana-rpc:${new URL(rpcUrl()).host}`;
}

async function rpc<T>(method: string, params: any[]): Promise<T> {
  const call = () => fetch(rpcUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(15000),
  });
  // Public mainnet rate-limits bursts — sometimes as HTTP 429, sometimes as
  // a JSON-RPC error body with code 429. Back off twice before giving up.
  let json: any = null;
  for (let attempt = 0; ; attempt++) {
    const res = await call();
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    const rateLimited = res.status === 429 || body?.error?.code === 429;
    if (rateLimited && attempt < 2) {
      await new Promise((r) => setTimeout(r, [1500, 4000][attempt]));
      continue;
    }
    if (!res.ok) throw new Error(`rpc ${method}: HTTP ${res.status}`);
    json = body;
    break;
  }
  if (json?.error) throw new Error(`rpc ${method}: ${json.error.message}`);
  return json?.result as T;
}

function base<T extends ChainFact<any>>(
  kind: T['kind'], mint: string, slot: number | null,
  payload: T['payload'], source: string, sourceUrl: string | null = null,
): T {
  return {
    kind,
    contractVersion: CONTRACT_VERSION,
    observedAt: new Date().toISOString(),
    slot,
    source,
    sourceUrl,
    chainId: 'solana',
    mint,
    payload,
  } as T;
}

export function createSolanaRpcProviderCore(): ReadonlyChainProvider {
  const src = rpcSource();

  async function fetchMintInfo(mint: string) {
    const r = await rpc<any>('getAccountInfo', [mint, { encoding: 'jsonParsed', commitment: 'confirmed' }]);
    const info = r?.value?.data?.parsed?.info;
    return { info, slot: r?.context?.slot ?? null };
  }

  return {
    id: 'solana-rpc',
    contractVersion: CONTRACT_VERSION,

    async mintAuthorities(mint) {
      const { info, slot } = await fetchMintInfo(mint);
      const payload = parseMintAccount(info);
      if (!payload) throw new Error(`mint account not decodable (not an SPL mint?): ${mint}`);
      return base('mint-authority', mint, slot, payload, src);
    },

    async holderDistribution(mint) {
      // Sequential on purpose: public RPC rate-limits bursts (HTTP 429).
      const largest = await rpc<any>('getTokenLargestAccounts', [mint, { commitment: 'confirmed' }]);
      const supply = await rpc<any>('getTokenSupply', [mint, { commitment: 'confirmed' }]);
      const slotRes = await rpc<any>('getSlot', [{ commitment: 'confirmed' }]);
      const payload = parseHolderAccounts(largest?.value, supply?.value?.amount ? { supply: supply.value.amount } : null);
      if (!payload) throw new Error(`holder distribution not computable for ${mint}`);
      return base('holder-distribution', mint, slotRes ?? null, payload, src);
    },

    async liquidity(mint) {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
        signal: AbortSignal.timeout(15000),
      });
      const json: any = await res.json();
      return base('liquidity', mint, null, parseDexScreener(json, mint), 'dexscreener', `https://dexscreener.com/solana/token/${mint}`);
    },

    async sellSimulation(mint) {
      const supply = await rpc<any>('getTokenSupply', [mint, { commitment: 'confirmed' }]);
      const amount = standardSellSize(String(supply?.value?.amount ?? '0'));
      const fetchQuote = async (inputMint: string, outputMint: string, amt: string) => {
        const url = `https://lite-api.jup.ag/swap/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amt}&slippageBps=50`;
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
          return res.ok ? await res.json() : null;
        } catch {
          return null;
        }
      };
      let payload: SellSimulationPayload | null = null;
      if (Number(amount) > 0) {
        payload = parseJupiterQuote(await fetchQuote(mint, WSOL, amount), amount);
        const buyQuote = await fetchQuote(WSOL, mint, String(10 * 1_000_000_000)); // 10 SOL
        payload.buy = parseBuyQuote(buyQuote);
      } else {
        payload = parseJupiterQuote(null, '0');
      }
      return base('sell-simulation', mint, null, payload, 'jupiter-quote', 'https://lite-api.jup.ag/swap/v1/quote');
    },

    async relatedWallets(_mint) {
      // Cluster attribution needs wallet-graph ingestion (transfer/funding
      // analysis), which public read-only quotes do not provide. The
      // collector records the failure and the gate stays UNKNOWN (fail-closed).
      throw new Error('related-wallet cluster analysis not available from read-only quotes; requires wallet-graph ingestion');
    },

    async programVerification(mint, programId) {
      if (!programId) {
        return base('program-verification', mint, null, {
          programId: '', owner: null, upgradeAuthority: null, immutable: false, verifiedBuild: null,
        }, src);
      }
      const r = await rpc<any>('getMultipleAccounts', [[programId], { encoding: 'base64', commitment: 'confirmed' }]);
      const prog = r?.value?.[0] ?? null;
      let programData: { data: [string, string] } | null = null;
      let programDataKey: string | null = null;
      if (prog?.data) {
        const bytes = Buffer.from(prog.data[0], 'base64');
        if (bytes.length >= 36) programDataKey = b58encode(bytes.subarray(4, 36));
      }
      if (programDataKey) {
        const pd = await rpc<any>('getMultipleAccounts', [[programDataKey], { encoding: 'base64', commitment: 'confirmed' }]);
        programData = pd?.value?.[0] ?? null;
      }
      const payload = parseProgramAccounts(programId, prog?.data ? prog : null, programData);
      return base('program-verification', mint, r?.context?.slot ?? null, payload, src);
    },
  };
}
