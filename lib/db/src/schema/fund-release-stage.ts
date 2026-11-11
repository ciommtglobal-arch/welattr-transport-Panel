// Phase 1 establishes referenced keys. Phase 2 adds the composite relationships.
// Advance only after read-only production metadata confirms phase 1 completed.
// Never derive this from NODE_ENV or use it as an application authorization gate.
export const fundAmendmentReleasePlan: {
  readonly stage: "keys-first" | "relationships";
} = { stage: "keys-first" };
