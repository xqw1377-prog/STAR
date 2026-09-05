/**
 * B1 Narrative Event Log contract (CONSENSUS-OPERATING-MODEL FROZEN-rev1).
 * B1 records reality only: world events, narratives, one-way Event→Narrative
 * links, Narrative→Asset attribution, and §14 time anchors. B1 never derives
 * signal / score / gate / decision / exit — hard acceptance condition B1-8.
 */

export const B1_RECORDER_VERSION = 'b1-recorder@1';

/** One-way edge kinds. There is no reverse (Narrative→Event) edge, by model §2. */
export const B1_EVENT_RELATIONS = ['produces', 'contributes_to'] as const;
export type B1EventRelation = (typeof B1_EVENT_RELATIONS)[number];

/** How an asset was attributed INTO a narrative (cluster membership). */
export const B1_ATTRIBUTION_BASES = ['name-match', 'alias-match', 'metadata-match', 'labeled'] as const;
export type B1AttributionBasis = (typeof B1_ATTRIBUTION_BASES)[number];

/** §14 anchor set. Social anchors carry basis 'labeled' until B3 sensors exist. */
export const B1_ANCHOR_KINDS = [
  'T_event',
  'T_seed',
  'T_name',
  'T_first_token',
  'T_first_pool',
  'T_first_smart_money',
  'T_mass',
  'T_public',
] as const;
export type B1AnchorKind = (typeof B1_ANCHOR_KINDS)[number];

export const B1_ANCHOR_BASES = ['observed', 'labeled'] as const;
export type B1AnchorBasis = (typeof B1_ANCHOR_BASES)[number];

export function assertIsoUtc(value: string, field: string): void {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(value)) {
    throw new Error(`B1 contract: ${field} must be ISO UTC (…Z), got ${value}`);
  }
}

export function assertRelation(value: string): asserts value is B1EventRelation {
  if (!(B1_EVENT_RELATIONS as readonly string[]).includes(value)) {
    throw new Error(`B1 contract: relation must be one of ${B1_EVENT_RELATIONS.join('|')}, got ${value}`);
  }
}

export function assertAttributionBasis(value: string): asserts value is B1AttributionBasis {
  if (!(B1_ATTRIBUTION_BASES as readonly string[]).includes(value)) {
    throw new Error(`B1 contract: attributionBasis must be one of ${B1_ATTRIBUTION_BASES.join('|')}, got ${value}`);
  }
}

export function assertAnchorKind(value: string): asserts value is B1AnchorKind {
  if (!(B1_ANCHOR_KINDS as readonly string[]).includes(value)) {
    throw new Error(`B1 contract: anchor must be one of ${B1_ANCHOR_KINDS.join('|')}, got ${value}`);
  }
}

export function assertAnchorBasis(value: string): asserts value is B1AnchorBasis {
  if (!(B1_ANCHOR_BASES as readonly string[]).includes(value)) {
    throw new Error(`B1 contract: basis must be one of ${B1_ANCHOR_BASES.join('|')}, got ${value}`);
  }
}
