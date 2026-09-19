// Deterministic IDs for service tests: services take `newId` in their context, so tests can
// predict and read back every row they create.
export function idSequence(prefix = 'id'): () => string {
  let n = 0;
  return () => `${prefix}-${++n}`;
}
