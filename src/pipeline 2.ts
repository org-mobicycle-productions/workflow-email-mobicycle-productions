import type { Env } from './shared/types';
import { getKVBindings } from './shared/kv-bindings';
import { checkTunnel, checkBackend, checkBridge, fetchEmails } from './part1_fetch/index';
import { storeEmails } from './part2_store/index';
import { triageNamespace } from './part3_triage/index';
import classificationRules from '../classification-rules.json';

export async function runPipeline(env: Env) {
  const timestamp = new Date().toISOString();

  // Check each hop
  const tunnel = await checkTunnel(env.TUNNEL_URL);
  if (!tunnel.ok) {
    const summary = { timestamp, status: 'skipped', reason: 'tunnel down', tunnel };
    await env.DASHBOARD_SCREENSHOTS.put('pipeline_last_run', JSON.stringify(summary));
    return summary;
  }

  const backend = await checkBackend(env.TUNNEL_URL);
  if (!backend.ok) {
    const summary = { timestamp, status: 'skipped', reason: 'backend down', tunnel, backend };
    await env.DASHBOARD_SCREENSHOTS.put('pipeline_last_run', JSON.stringify(summary));
    return summary;
  }

  const bridge = await checkBridge(env.TUNNEL_URL);
  if (!bridge.ok) {
    const summary = { timestamp, status: 'skipped', reason: 'bridge down', tunnel, backend, bridge };
    await env.DASHBOARD_SCREENSHOTS.put('pipeline_last_run', JSON.stringify(summary));
    return summary;
  }

  // Part 1: Fetch
  const fetchResult = await fetchEmails(env.TUNNEL_URL);

  // Part 2: Store
  const rules = (classificationRules as any).rules || [];
  const storeResult = await storeEmails(fetchResult.emails, rules, getKVBindings(env));

  // Part 3: Triage
  const triageResult = await triageNamespace(env.FILTERED_DATA_HEADERS, 'FILTERED_DATA_HEADERS');

  const summary = {
    timestamp,
    status: 'complete',
    part1: {
      fetched: fetchResult.fetched,
      inbound: fetchResult.inbound,
      roseFiltered: fetchResult.filtered,
    },
    part2: {
      rawStored: storeResult.rawStored,
      filteredStored: storeResult.filteredStored,
      routeStats: storeResult.routeStats,
    },
    part3: {
      total: triageResult.length,
      noted: triageResult.filter((d: any) => d.level === 'NOTED').length,
      simple: triageResult.filter((d: any) => d.level === 'SIMPLE').length,
      complex: triageResult.filter((d: any) => d.level === 'COMPLEX').length,
    },
  };

  await env.DASHBOARD_SCREENSHOTS.put('pipeline_last_run', JSON.stringify(summary));
  return summary;
}
