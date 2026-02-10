import type { Env } from '../shared/types';
import { getKVBindings, NAMESPACE_META } from '../shared/kv-bindings';

export async function handleKvCounts(env: Env): Promise<Response> {
  const bindings = getKVBindings(env);
  const counts: Record<string, { name: string; category: string; count: number }> = {};
  let rawCount = 0;
  let filteredCount = 0;
  let total = 0;

  for (const [slug, meta] of Object.entries(NAMESPACE_META)) {
    const ns = bindings[meta.binding];
    if (!ns) continue;
    const keys = await ns.list();
    const count = keys.keys.length;
    counts[slug] = { name: meta.name, category: meta.category, count };
    if (meta.binding === 'RAW_DATA_HEADERS') rawCount = count;
    else if (meta.binding === 'FILTERED_DATA_HEADERS') filteredCount = count;
    else total += count;
  }

  return Response.json({ total, raw: rawCount, filtered: filteredCount, namespaces: Object.keys(counts).length, counts });
}
