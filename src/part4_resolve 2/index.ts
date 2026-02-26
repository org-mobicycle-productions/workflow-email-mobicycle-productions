import type { Env } from '../shared/types';

export interface ResolveResult {
  key: string;
  level: string;
  action: string;
  output?: any;
  error?: string;
}

export async function resolveDecisions(
  decisions: { key: string; level: string; reason: string; email: any }[],
  env: Env,
): Promise<ResolveResult[]> {
  const results: ResolveResult[] = [];

  for (const decision of decisions) {
    try {
      switch (decision.level) {
        case 'NO_ACTION':
          results.push({ key: decision.key, level: decision.level, action: 'closed' });
          break;
        case 'SIMPLE':
          results.push({ key: decision.key, level: decision.level, action: 'draft_reply', output: { status: 'pending_implementation' } });
          break;
        case 'LOW_COMPLEX':
          results.push({ key: decision.key, level: decision.level, action: 'draft_letter', output: { status: 'pending_implementation' } });
          break;
        case 'HIGH_COMPLEX':
          results.push({ key: decision.key, level: decision.level, action: 'generate_documents', output: { status: 'pending_implementation' } });
          break;
        default:
          results.push({ key: decision.key, level: decision.level, action: 'unknown_level', error: 'Unhandled: ' + decision.level });
      }
    } catch (e: any) {
      results.push({ key: decision.key, level: decision.level, action: 'error', error: e.message });
    }
  }

  return results;
}
