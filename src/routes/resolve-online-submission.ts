import type { Env } from '../shared/types';

/**
 * GET: Show emails queued for online submission (CE-File, UKSC portal).
 * POST: Submit documents to court portal for a specific email key.
 *
 * Placeholder — not yet implemented.
 */
export async function handleResolveOnlineSubmission(request: Request, env: Env): Promise<Response> {
  if (request.method === 'POST') {
    return Response.json({ status: 'not_implemented', action: 'resolve-online-submission' });
  }
  return Response.json({ status: 'not_implemented', description: 'Will submit documents to CE-File or UKSC portal' });
}
