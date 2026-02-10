import type { Env } from '../shared/types';
import { getKVBindings } from '../shared/kv-bindings';
import { fetchEmails } from '../part1_fetch/index';
import { formatKey, formatValue, classify } from '../part2_store/index';
import classificationRules from '../../classification-rules.json';

/**
 * Route classified emails to their category-specific KV namespaces.
 * Chains from: run-fetch → run-kv-namespace-raw → run-kv-namespace-filtered → this.
 */
export async function handleRunKvNamespaceFinal(env: Env): Promise<Response> {
  try {
    const fetched = await fetchEmails(env.TUNNEL_URL);
    const rules = (classificationRules as any).rules || [];
    const bindings = getKVBindings(env);
    const routeStats: Record<string, number> = {};

    for (const email of fetched.emails) {
      const result = classify(email, rules);
      if (!result.matched) continue;
      const key = formatKey(email.from, email.date);
      for (const ns of result.namespaces) {
        const namespace = bindings[ns];
        if (namespace) {
          await namespace.put(key, formatValue(email, result.namespaces));
          routeStats[ns] = (routeStats[ns] || 0) + 1;
        }
      }
    }
    return Response.json({ routeStats, namespacesHit: Object.keys(routeStats).length });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
