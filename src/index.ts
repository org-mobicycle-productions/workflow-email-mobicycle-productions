/**
 * MobiCycle OU Email Workflow — Worker Entry Point
 *
 * Every route is named after what it does.
 * No combined endpoints. One route = one thing.
 */
import type { Env } from './shared/types';
import { checkTunnel, checkBackend, checkBridge } from './part1_fetch/index';
import { runPipeline } from './pipeline';

// Check (infrastructure)
import { handleCheckTunnel } from './routes/check-tunnel';
import { handleCheckBackend } from './routes/check-backend';
import { handleCheckBridge } from './routes/check-bridge';

// Run (pipeline steps)
import { handleRunFetch } from './routes/run-fetch';
import { handleRunKvNamespaceRaw } from './routes/run-kv-namespace-raw';
import { handleRunKvNamespaceFiltered } from './routes/run-kv-namespace-filtered';
import { handleRunKvNamespaceFinal } from './routes/run-kv-namespace-final';

// Sort (new step between filter and triage)
import { handleSort } from './routes/sort';

// Pipeline data namespaces
import { handleRawDataHeaders } from './routes/raw-data-headers';
import { handleFilteredDataHeaders } from './routes/filtered-data-headers';
import { handleTodoScanner } from './routes/todo-scanner';

// Triage (GET reads, POST executes)
import { handleTriageDetermine } from './routes/triage-determine';
import { handleTriageNoAction } from './routes/triage-no-action';
import { handleTriageSimple } from './routes/triage-simple';
import { handleTriageComplexityLow } from './routes/triage-complexity-low';
import { handleTriageComplexityHigh } from './routes/triage-complexity-high';

// Resolve (placeholders)
import { handleResolveLetter } from './routes/resolve-letter';
import { handleResolveApplication } from './routes/resolve-application';
import { handleResolveOnlineSubmission } from './routes/resolve-online-submission';
import { handleResolveEmailCoverLetter } from './routes/resolve-email-cover-letter';

// Dashboard API
import { handleDashboardData } from './routes/dashboard-data';
import { handleKvCounts } from './routes/kv-counts';
import { handleKvEmails } from './routes/kv-emails';
import { handleStatus } from './routes/status';

class EmailTriageWorkflow {
  async run() { return { status: 'stub' }; }
}
export { EmailTriageWorkflow };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Check
    if (path === '/check-tunnel') return handleCheckTunnel(env);
    if (path === '/check-backend') return handleCheckBackend(env);
    if (path === '/check-bridge') return handleCheckBridge(env);

    // Run
    if (path === '/run-fetch') return handleRunFetch(env);
    if (path === '/run-kv-namespace-raw') return handleRunKvNamespaceRaw(env);
    if (path === '/run-kv-namespace-filtered') return handleRunKvNamespaceFiltered(env);
    if (path === '/run-kv-namespace-final') return handleRunKvNamespaceFinal(env);

    // Sort (between filter and triage)
    if (path === '/sort') return handleSort(request, env);

    // Pipeline data namespaces
    if (path === '/raw-data-headers') return handleRawDataHeaders(request, env);
    if (path === '/filtered-data-headers') return handleFilteredDataHeaders(request, env);
    if (path === '/todo-scanner') return handleTodoScanner(request, env);

    // Triage
    if (path === '/triage-determine') return handleTriageDetermine(request, env);
    if (path === '/triage-no-action') return handleTriageNoAction(request, env);
    if (path === '/triage-simple') return handleTriageSimple(request, env);
    if (path === '/triage-complexity-low') return handleTriageComplexityLow(request, env);
    if (path === '/triage-complexity-high') return handleTriageComplexityHigh(request, env);

    // Resolve
    if (path === '/resolve-letter') return handleResolveLetter(request, env);
    if (path === '/resolve-application') return handleResolveApplication(request, env);
    if (path === '/resolve-online-submission') return handleResolveOnlineSubmission(request, env);
    if (path === '/resolve-email-cover-letter') return handleResolveEmailCoverLetter(request, env);

    // Dashboard API
    if (path === '/api/dashboard-data') return handleDashboardData(env);
    if (path === '/api/kv-counts') return handleKvCounts(env);
    if (path === '/status') return handleStatus(env);
    if (path.startsWith('/api/kv-emails/')) {
      const slug = path.replace('/api/kv-emails/', '');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      return handleKvEmails(env, slug, limit);
    }

    return Response.json({
      error: 'Not found',
      routes: {
        check: [
          'GET /check-tunnel',
          'GET /check-backend',
          'GET /check-bridge',
        ],
        run: [
          'GET /run-fetch',
          'GET /run-kv-namespace-raw',
          'GET /run-kv-namespace-filtered',
          'GET /run-kv-namespace-final',
        ],
        sort: [
          'GET|POST /sort',
        ],
        data: [
          'GET|DELETE|POST /raw-data-headers',
          'GET|DELETE|PUT /filtered-data-headers',
        ],
        todo: [
          'GET /todo-scanner',
        ],
        triage: [
          'GET|POST /triage-determine',
          'GET|POST /triage-no-action',
          'GET|POST /triage-simple',
          'GET|POST /triage-complexity-low',
          'GET|POST /triage-complexity-high',
        ],
        resolve: [
          'GET|POST /resolve-letter',
          'GET|POST /resolve-application',
          'GET|POST /resolve-online-submission',
          'GET|POST /resolve-email-cover-letter',
        ],
        dashboard: [
          'GET /api/dashboard-data',
          'GET /api/kv-counts',
          'GET /api/kv-emails/:slug',
          'GET /status',
        ],
      },
    }, { status: 404 });
  },

  async scheduled(event: ScheduledEvent, env: Env) {
    const cron = event.cron;

    // Every 2 min: check each hop independently
    if (cron === '*/2 * * * *') {
      const now = new Date().toISOString();
      const tunnel = await checkTunnel(env.TUNNEL_URL);
      const backend = tunnel.ok ? await checkBackend(env.TUNNEL_URL) : { ok: false, url: 'localhost:4000', error: 'tunnel down' };
      const bridge = backend.ok ? await checkBridge(env.TUNNEL_URL) : { ok: false, url: '127.0.0.1:1143', error: 'backend down' };

      await env.DASHBOARD_SCREENSHOTS.put('hop_tunnel', JSON.stringify({ ...tunnel, checkedAt: now }));
      await env.DASHBOARD_SCREENSHOTS.put('hop_backend', JSON.stringify({ ...backend, checkedAt: now }));
      await env.DASHBOARD_SCREENSHOTS.put('hop_bridge', JSON.stringify({ ...bridge, checkedAt: now }));

      console.log(`[CHECK] tunnel=${tunnel.ok} backend=${backend.ok} bridge=${bridge.ok}`);
      return;
    }

    // Every 5 min: run pipeline if bridge is up
    if (cron === '*/5 * * * *') {
      const bridgeData = await env.DASHBOARD_SCREENSHOTS.get('hop_bridge');
      if (!bridgeData) {
        console.log('[PIPELINE] No bridge data yet, skipping');
        return;
      }
      const bridge = JSON.parse(bridgeData);
      if (!bridge.ok) {
        console.log(`[PIPELINE] Bridge not ready: ${bridge.error}, skipping`);
        return;
      }
      try {
        const result = await runPipeline(env);
        console.log(`[PIPELINE] Done: fetched=${(result as any).part1?.fetched}`);
      } catch (e: any) {
        console.error('[PIPELINE] Failed:', e.message);
        await env.DASHBOARD_SCREENSHOTS.put('pipeline_last_run', JSON.stringify({
          timestamp: new Date().toISOString(),
          status: 'error',
          error: e.message,
        }));
      }
      return;
    }

    // Hourly: status snapshot
    if (cron === '0 * * * *') {
      const [tunnel, backend, bridge, lastRun] = await Promise.all([
        env.DASHBOARD_SCREENSHOTS.get('hop_tunnel'),
        env.DASHBOARD_SCREENSHOTS.get('hop_backend'),
        env.DASHBOARD_SCREENSHOTS.get('hop_bridge'),
        env.DASHBOARD_SCREENSHOTS.get('pipeline_last_run'),
      ]);
      await env.DASHBOARD_SCREENSHOTS.put('status_snapshot', JSON.stringify({
        checkedAt: new Date().toISOString(),
        tunnel: tunnel ? JSON.parse(tunnel) : null,
        backend: backend ? JSON.parse(backend) : null,
        bridge: bridge ? JSON.parse(bridge) : null,
        lastPipelineRun: lastRun ? JSON.parse(lastRun) : null,
      }));
      console.log('[STATUS] Snapshot written');
      return;
    }
  },
};
