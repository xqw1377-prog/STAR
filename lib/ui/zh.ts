/** Display-only Chinese labels. Domain keys stay kebab / enum. */

export const BOUNDARY_ZH = '夹具自动阻击 · DRY_RUN · 无广播';
export const BOUNDARY_EN = 'FIXTURE AUTO-SNIPE · DRY_RUN · NO BROADCAST';

export const NAV_ZH = [
  { href: '/', label: '阻击台' },
  { href: '/cycle-radar', label: '观察·周期' },
  { href: '/narrative-map', label: '观察·叙事' },
  { href: '/project/proj-neural', label: '观察·审计' },
  { href: '/risk-center', label: '观察·风险' },
  { href: '/replay-lab', label: '观察·回放' },
] as const;

export const GATE_ZH: Record<string, string> = {
  'token-permissions': '代币权限',
  tradability: '可买卖性',
  liquidity: '流动性与退出',
  concentration: '持币集中度',
  'related-wallets': '关联钱包',
  'program-verification': '程序验证',
};

export const CHECK_ZH: Record<string, string> = {
  'mint-authority': '铸币权限',
  'freeze-authority': '冻结权限',
  'sell-simulation': '买卖模拟',
  liquidity: '流动性',
  'holder-distribution': '持币分布',
  'related-wallets': '关联钱包',
  'program-verification': '程序验证',
  'narrative-snapshot': '叙事快照',
  'lifecycle-transition': '生命周期迁移',
};

export const STATUS_ZH: Record<string, string> = {
  PASS: '通过',
  FAIL: '未通过',
  UNKNOWN: '未知',
};

export const READINESS_ZH: Record<string, string> = {
  READY: '可决策',
  BLOCKED: '已阻断',
  RESEARCH_REQUIRED: '需补研',
  TOO_LATE: '已过窗口',
};

export const LIFECYCLE_ZH: Record<string, string> = {
  SEED: '种子',
  IGNITION: '点火',
  VERIFIED: '已验证',
  ACCELERATION: '加速',
  CROWDING: '拥挤',
  DISTRIBUTION: '派发',
  DEAD: '死亡',
  UNKNOWN: '未知',
};

export const HEALTH_RATE_ZH = {
  success: '成功',
  partial: '部分成功',
  source_error: '来源错误',
  transport_error: '传输错误',
  timeout: '超时',
  aborted: '中止',
  response_availability: '响应可用率',
  unresolved: '未决率',
} as const;

export const DEGRADED_ZH: Record<string, string> = {
  LICENSE_HOLD: '许可冻结',
  RATE_LIMITED: '限流',
  TIMEOUT: '超时',
  CONFLICTED: '冲突',
  PARSER_DEGRADED: '解析降级',
  SOURCE_ERROR: '来源错误',
  NO_SAMPLE: '无样本',
  BACKFILL_ONLY: '仅回灌',
  NONE: '无',
};

export const LINEAGE_ZH: Record<string, string> = {
  LINKED: '已关联',
  UNLINKED: '未关联',
  PURGED: '已清除',
  ERASED: '已擦除',
};

export const REPLAY_MODE_ZH: Record<string, string> = {
  HISTORICAL: '历史冻结',
  REINTERPRET: '重新解释',
};

export const INELIGIBLE_ZH: Record<string, string> = {
  CONTESTED: '冲突未决',
  CONTRADICTED: '交叉矛盾',
  ERASED: '已擦除',
  REPLAY_SOURCE_PURGED: '回放源已清除',
};

export function zh(map: Record<string, string>, key: string | null | undefined): string {
  if (!key) return '—';
  return map[key] ?? key;
}

export function zhSource(source: string | null | undefined): string {
  if (!source) return '—';
  if (source === 'fixture') return '夹具';
  return source;
}

export function zhReason(reason: string): string {
  let out = reason;
  const pairs: Array<[string, string]> = [
    ...Object.entries(CHECK_ZH),
    ...Object.entries(GATE_ZH),
    ...Object.entries(STATUS_ZH),
    ['no evidence', '无证据'],
  ];
  for (const [en, cn] of pairs) {
    out = out.split(en).join(cn);
  }
  return out;
}
