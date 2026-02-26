import type { Env } from '../shared/types';
import { fetchEmails } from '../part1_fetch/index';
import { formatKey, formatValue, classify } from '../part2_store/index';
import classificationRules from '../../classification-rules.json';

/**
 * Store emails that match classification rules in FILTERED_DATA_HEADERS.
 * Chains from: run-fetch → run-kv-namespace-raw → this.
 */
export async function handleRunKvNamespaceFiltered(env: Env): Promise<Response> {
  try {
    const fetched = await fetchEmails(env.TUNNEL_URL);
    const rules = (classificationRules as any).rules || [];
    let stored = 0;
    for (const email of fetched.emails) {
      const result = classify(email, rules);
      if (!result.matched) continue;
      const key = formatKey(email.from, email.date);
      await env.FILTERED_DATA_HEADERS.put(key, formatValue(email, result.namespaces));
      stored++;
    }
    return Response.json({ stored, totalInbound: fetched.inbound });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
