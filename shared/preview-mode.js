// The validated source owns preview behaviour; catalogue IDs also identify
// archived combat studies and must never turn a layout back into combat.
export const isNonCombatPreview=level=>level?.previewMode==='landscape'||level?.previewMode==='layout';
