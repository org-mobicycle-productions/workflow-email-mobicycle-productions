import type { Env } from '../shared/types';
import { triageNamespace } from '../part3_triage/index';

export async function handleTriageNoAction(request: Request, env: Env): Promise<Response> {
  const all = await triageNamespace(env.FILTERED_DATA_HEADERS, 'FILTERED_DATA_HEADERS');
  const matched = all.filter(d => d.level === 'NO_ACTION');

  if (request.method === 'POST') {
    for (const d of matched) {
      const raw = await env.FILTERED_DATA_HEADERS.get(d.key);
      if (!raw) continue;
      const email = JSON.parse(raw);
      email.status = 'closed';
      email.triageLevel = 'NO_ACTION';
      email.closedAt = new Date().toISOString();
      await env.FILTERED_DATA_HEADERS.put(d.key, JSON.stringify(email));
    }
    return Response.json({ closed: matched.length });
  }

  return Response.json({ count: matched.length, emails: matched });
}
