import type { Env } from '../shared/types';

export async function handleCheckTunnel(env: Env): Promise<Response> {
  try {
    const res = await fetch(env.TUNNEL_URL, { signal: AbortSignal.timeout(5000) });
    return Response.json({ reachable: res.ok, status: res.status, url: env.TUNNEL_URL });
  } catch (e: any) {
    return Response.json({ reachable: false, url: env.TUNNEL_URL, error: e.message });
  }
}
