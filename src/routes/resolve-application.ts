import type { Env } from '../shared/types';

/**
 * GET: Show emails queued for court application generation.
 * POST: Generate application (N244, appeal form, etc.) for a specific email key.
 *
 * Placeholder — not yet implemented.
 */
export async function handleResolveApplication(request: Request, env: Env): Promise<Response> {
  if (request.method === 'POST') {
    return Response.json({ status: 'not_implemented', action: 'resolve-application' });
  }
  return Response.json({ status: 'not_implemented', description: 'Will generate court applications (N244, appeal forms) for high-complexity emails' });
}
