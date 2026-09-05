/** Live re-evaluation of why we are in the trade. Null = radar dark, not invented. */
export interface ThesisLive {
  narrativeAlive: boolean | null;
  moneyStillIn: boolean | null;
  earlyWalletsActive: boolean | null;
  liquidityOk: boolean;
  holderWorse: boolean | null;
  devAnomaly: boolean | null;
  structureChanged: boolean | null;
}

export function thesisBroken(live: ThesisLive): string[] {
  const why: string[] = [];
  if (live.narrativeAlive === false) why.push('narrative gone');
  if (live.moneyStillIn === false) why.push('money left');
  if (live.earlyWalletsActive === false) why.push('early wallets quiet');
  if (!live.liquidityOk) why.push('liquidity failed');
  if (live.holderWorse === true) why.push('holders worse');
  if (live.devAnomaly === true) why.push('dev anomaly');
  if (live.structureChanged === true) why.push('market structure changed');
  return why;
}
