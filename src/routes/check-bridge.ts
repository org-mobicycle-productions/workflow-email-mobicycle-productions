import type { Env } from '../shared/types';

export async function handleCheckBridge(env: Env): Promise<Response> {
  try {
    const res = await fetch(`${env.TUNNEL_URL}/health`, { signal: AbortSignal.timeout(5000) });
    const data = (await res.json()) as any;
    const bridgeAddr = data.config?.bridge || '127.0.0.1:1143';
    if (data.status !== 'ok') {
      return Response.json({ reachable: false, url: bridgeAddr, error: data.error || 'backend unhealthy' });
    }
    return Response.json({ reachable: true, bridge: bridgeAddr, url: bridgeAddr });
  } catch (e: any) {
    return Response.json({ reachable: false, url: '127.0.0.1:1143', error: e.message });
  }
}
