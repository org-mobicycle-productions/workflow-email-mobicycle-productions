import type { Env } from '../shared/types';

/**
 * GET: Show emails queued for cover letter drafting.
 * POST: Draft and send cover letter with attachments for a specific email key.
 *
 * Placeholder — not yet implemented.
 */
export async function handleResolveEmailCoverLetter(request: Request, env: Env): Promise<Response> {
  if (request.method === 'POST') {
    return Response.json({ status: 'not_implemented', action: 'resolve-email-cover-letter' });
  }
  return Response.json({ status: 'not_implemented', description: 'Will draft email cover letters and send with attachments via SMTP' });
}
