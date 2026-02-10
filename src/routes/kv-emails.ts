import type { Env } from '../shared/types';
import { getKVBindings, NAMESPACE_META } from '../shared/kv-bindings';

export async function handleKvEmails(env: Env, slug: string, limit: number): Promise<Response> {
  const meta = NAMESPACE_META[slug];
  if (!meta) return Response.json({ error: `Unknown namespace: ${slug}` }, { status: 404 });

  const bindings = getKVBindings(env);
  const ns = bindings[meta.binding];
  if (!ns) return Response.json({ error: `Binding not found: ${meta.binding}` }, { status: 500 });

  const keys = await ns.list({ limit });
  const emails: any[] = [];
  for (const key of keys.keys) {
    const raw = await ns.get(key.name);
    if (!raw) continue;
    const parsed = JSON.parse(raw);
    emails.push({
      key: key.name,
      from: parsed.from,
      to: parsed.to,
      subject: parsed.subject,
      date: parsed.date,
      status: parsed.status,
      triageLevel: parsed.triageLevel,
      namespaces: parsed.namespaces,
    });
  }

  return Response.json({ namespace: meta.name, category: meta.category, count: emails.length, emails });
}
