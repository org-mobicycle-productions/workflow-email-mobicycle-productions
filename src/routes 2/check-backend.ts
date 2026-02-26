import type { Env } from '../shared/types';

export async function handleCheckBackend(env: Env): Promise<Response> {
  try {
    const res = await fetch(`${env.TUNNEL_URL}/health`, { signal: AbortSignal.timeout(5000) });
    if (res.status === 502 || res.status === 504) {
      return Response.json({ reachable: false, url: 'localhost:4000', error: `tunnel returned ${res.status}` });
    }
    const data = (await res.json()) as any;
    return Response.json({
      reachable: data.status === 'ok',
      service: data.service,
      account: data.account,
      url: 'localhost:4000',
    });
  } catch (e: any) {
    return Response.json({ reachable: false, url: 'localhost:4000', error: e.message });
  }
}
