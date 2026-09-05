/** Discovery output. Never a trade decision. */
export interface Candidate {
  mint: string;
  source: 'synthetic-fixtures' | 'ave.ai';
  observedAt: string;
  hints: {
    smartMoney?: boolean;
    devActivity?: boolean;
    holderStructure?: boolean;
    tradingActivity?: boolean;
    liquidity?: boolean;
  };
}
