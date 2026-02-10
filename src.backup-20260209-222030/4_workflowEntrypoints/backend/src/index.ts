/**
 * Email Backend Service - MobiCycle Productions
 * ------------------------------------
 * Local HTTP service on port 6000 that bridges ProtonMail Bridge to Cloudflare Workers.
 * Accessed via Cloudflare Tunnel at mail.mobicycle.productions
 *
 * ProtonMail Bridge runs locally:
 *   - IMAP: localhost:1143
 *   - SMTP: localhost:1025
 *
 * CRITICAL: This service is ONLY for the MobiCycle Productions account.
 * Each Cloudflare account has its own dedicated backend service.
 */

import { fetchEmails, getEmailCount, type FetchEmailsRequest } from './imap-client';
import { sendEmail, type SendEmailRequest } from './smtp-client';

const PORT = 6000;
const ACCOUNT = 'mobicycle-productions';

const server = Bun.serve({
	port: PORT,
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		// CORS headers
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		};

		if (request.method === 'OPTIONS') {
			return new Response(null, { status: 200, headers: corsHeaders });
		}

		try {
			let response: Response;

			switch (path) {
				case '/fetch-emails': {
					if (request.method !== 'POST') {
						return new Response('Method not allowed', { status: 405, headers: corsHeaders });
					}
					const body = (await request.json()) as FetchEmailsRequest;
					const emails = await fetchEmails(body);
					response = new Response(JSON.stringify(emails), {
						headers: { 'Content-Type': 'application/json', ...corsHeaders },
					});
					break;
				}

				case '/send-email': {
					if (request.method !== 'POST') {
						return new Response('Method not allowed', { status: 405, headers: corsHeaders });
					}
					const body = (await request.json()) as SendEmailRequest;
					const result = await sendEmail(body);
					response = new Response(JSON.stringify(result), {
						headers: { 'Content-Type': 'application/json', ...corsHeaders },
					});
					break;
				}

				case '/email-count': {
					if (request.method !== 'GET') {
						return new Response('Method not allowed', { status: 405, headers: corsHeaders });
					}
					const mailbox = url.searchParams.get('mailbox') || 'INBOX';
					const count = await getEmailCount(mailbox);
					response = new Response(
						JSON.stringify({
							mailbox,
							totalCount: count,
							timestamp: new Date().toISOString(),
						}),
						{
							headers: { 'Content-Type': 'application/json', ...corsHeaders },
						}
					);
					break;
				}

				case '/health': {
					response = new Response(
						JSON.stringify({
							status: 'healthy',
							service: 'email-backend-service',
							account: ACCOUNT,
							port: PORT,
							protonBridge: {
								imap: 'localhost:1143',
								smtp: 'localhost:1025',
							},
							timestamp: new Date().toISOString(),
						}),
						{
							headers: { 'Content-Type': 'application/json', ...corsHeaders },
						}
					);
					break;
				}

				case '/': {
					response = new Response(
						JSON.stringify({
							service: 'MobiCycle Productions Email Backend Service',
							account: ACCOUNT,
							port: PORT,
							description: 'Bridges ProtonMail Bridge IMAP/SMTP to HTTP for Cloudflare Workers',
							endpoints: ['/fetch-emails', '/send-email', '/email-count', '/health'],
							tunnel: 'mail.mobicycle.productions',
							timestamp: new Date().toISOString(),
						}),
						{
							headers: { 'Content-Type': 'application/json', ...corsHeaders },
						}
					);
					break;
				}

				default:
					response = new Response('Not Found', { status: 404, headers: corsHeaders });
			}

			return response;
		} catch (error: any) {
			console.error(`[EMAIL BACKEND] Error on ${path}:`, error);
			return new Response(
				JSON.stringify({
					error: 'Internal server error',
					message: error.message,
					timestamp: new Date().toISOString(),
				}),
				{
					status: 500,
					headers: { 'Content-Type': 'application/json', ...corsHeaders },
				}
			);
		}
	},
});

console.log(`[EMAIL BACKEND] MobiCycle Productions email-backend-service running on port ${PORT}`);
console.log(`[EMAIL BACKEND] ProtonMail Bridge IMAP: localhost:1143`);
console.log(`[EMAIL BACKEND] ProtonMail Bridge SMTP: localhost:1025`);
console.log(`[EMAIL BACKEND] Tunnel: mail.mobicycle.productions -> localhost:${PORT}`);
