import type { Env } from '../shared/types';

export async function handleDashboardData(env: Env): Promise<Response> {
  const [tunnel, backend, bridge, pipelineRun, statusSnapshot] = await Promise.all([
    env.DASHBOARD_SCREENSHOTS.get('hop_tunnel'),
    env.DASHBOARD_SCREENSHOTS.get('hop_backend'),
    env.DASHBOARD_SCREENSHOTS.get('hop_bridge'),
    env.DASHBOARD_SCREENSHOTS.get('pipeline_last_run'),
    env.DASHBOARD_SCREENSHOTS.get('status_snapshot'),
  ]);
  return Response.json({
    tunnel: tunnel ? JSON.parse(tunnel) : null,
    backend: backend ? JSON.parse(backend) : null,
    bridge: bridge ? JSON.parse(bridge) : null,
    pipeline: pipelineRun ? JSON.parse(pipelineRun) : null,
    status: statusSnapshot ? JSON.parse(statusSnapshot) : null,
  });
}
