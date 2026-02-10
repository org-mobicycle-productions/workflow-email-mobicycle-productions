import type { Env } from '../shared/types';

/**
 * GET: Show emails queued for letter generation.
 * POST: Generate letter for a specific email key.
 *
 * Placeholder — not yet implemented.
 */
export async function handleResolveLetter(request: Request, env: Env): Promise<Response> {
  if (request.method === 'POST') {
    return Response.json({ status: 'not_implemented', action: 'resolve-letter' });
  }
  return Response.json({ status: 'not_implemented', description: 'Will generate formal letters for low-complexity emails' });
}
