// Best-effort reuse inside a warm instance; correctness never depends on affinity.
// Cache only public upstream data, never sessions or personalized responses.
export function createAsyncCache({ ttlMs = 300000, maxEntries = 100, now = Date.now } = {}) {
  const values = new Map();
  const pending = new Map();
  return async function load(key, factory) {
    const old = values.get(key);
    if (old && old.expires > now()) {
      values.delete(key); values.set(key, old);
      return old.value;
    }
    values.delete(key);
    if (pending.has(key)) return pending.get(key);
    const task = Promise.resolve().then(factory).then(value => {
      values.set(key, { value, expires: now() + ttlMs });
      while (values.size > maxEntries) values.delete(values.keys().next().value);
      return value;
    });
    // Bound bookkeeping even during a burst of distinct queries.
    if (pending.size < maxEntries) pending.set(key, task);
    try { return await task; }
    finally { if (pending.get(key) === task) pending.delete(key); }
  };
}
