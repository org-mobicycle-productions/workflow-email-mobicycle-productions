import type { Env } from '../shared/types';

export async function handleStatus(env: Env): Promise<Response> {
  const last = await env.DASHBOARD_SCREENSHOTS.get('pipeline_last_run');
  return Response.json(last ? JSON.parse(last) : { status: 'never_run' });
}
