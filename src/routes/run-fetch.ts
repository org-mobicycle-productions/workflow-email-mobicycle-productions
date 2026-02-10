import type { Env } from '../shared/types';
import { fetchEmails } from '../part1_fetch/index';

export async function handleRunFetch(env: Env): Promise<Response> {
  try {
    const result = await fetchEmails(env.TUNNEL_URL);
    return Response.json(result);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
