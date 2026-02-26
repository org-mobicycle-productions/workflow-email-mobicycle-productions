import type { Env } from '../shared/types';
import { triageNamespace } from '../part3_triage/index';

export async function handleTriageDetermine(request: Request, env: Env): Promise<Response> {
  const decisions = await triageNamespace(env.FILTERED_DATA_HEADERS, 'FILTERED_DATA_HEADERS');

  if (request.method === 'POST') {
    for (const d of decisions) {
      const raw = await env.FILTERED_DATA_HEADERS.get(d.key);
      if (!raw) continue;
      const email = JSON.parse(raw);
      email.triageLevel = d.level;
      email.triageReason = d.reason;
      email.triageSuggestedAction = d.suggestedAction;
      email.status = 'triaged';
      await env.FILTERED_DATA_HEADERS.put(d.key, JSON.stringify(email));
    }
    return Response.json({ applied: decisions.length, decisions });
  }

  return Response.json({
    total: decisions.length,
    noAction: decisions.filter(d => d.level === 'NO_ACTION').length,
    simple: decisions.filter(d => d.level === 'SIMPLE').length,
    lowComplex: decisions.filter(d => d.level === 'LOW_COMPLEX').length,
    highComplex: decisions.filter(d => d.level === 'HIGH_COMPLEX').length,
    decisions,
  });
}
