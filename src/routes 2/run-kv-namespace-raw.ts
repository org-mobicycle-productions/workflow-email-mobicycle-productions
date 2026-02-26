import type { Env } from '../shared/types';
import { fetchEmails } from '../part1_fetch/index';
import { formatKey, formatValue } from '../part2_store/index';

/**
 * Store all inbound emails in RAW_DATA_HEADERS.
 * Chains from: run-fetch (fetches emails first).
 */
export async function handleRunKvNamespaceRaw(env: Env): Promise<Response> {
  try {
    const fetched = await fetchEmails(env.TUNNEL_URL);
    let stored = 0;
    for (const email of fetched.emails) {
      const key = formatKey(email.from, email.date);
      await env.RAW_DATA_HEADERS.put(key, formatValue(email, []));
      stored++;
    }
    return Response.json({ stored, fetched: fetched.fetched, inbound: fetched.inbound });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
