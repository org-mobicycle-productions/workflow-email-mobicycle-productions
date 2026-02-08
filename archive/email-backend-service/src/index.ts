/**
 * Email Backend Service - MobiCycle Productions
 * ----------------------------------------------
 * Local HTTP service on port 4002 that bridges ProtonMail Bridge to Cloudflare Workers.
 * Accessed via Cloudflare Tunnel at mail.mobicycle.productions
 *
 * ProtonMail Bridge runs locally:
 *   - IMAP: localhost:1145
 *   - SMTP: localhost:1027
 *
 * CRITICAL: This service is ONLY for the MobiCycle Productions account.
 * Each Cloudflare account has its own dedicated backend service.
 */

import { fetchEmails, getEmailCount, listMailboxes, type FetchEmailsRequest } from './imap-client';
import { sendEmail, type SendEmailRequest } from './smtp-client';

const PORT = 4002;
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
					response = new Response(
						JSON.stringify({
							success: true,
							count: emails.length,
							emails,
						}),
						{
						headers: { 'Content-Type': 'application/json', ...corsHeaders },
						}
					);
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

				case '/mailboxes': {
					if (request.method !== 'GET') {
						return new Response('Method not allowed', { status: 405, headers: corsHeaders });
					}
					const mailboxes = await listMailboxes();
					response = new Response(
						JSON.stringify({
							success: true,
							count: mailboxes.length,
							mailboxes,
							timestamp: new Date().toISOString(),
						}),
						{
							headers: { 'Content-Type': 'application/json', ...corsHeaders },
						}
					);
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
					const imapPort = process.env.IMAP_PORT || '1145';
					const smtpPort = process.env.SMTP_PORT || '1027';
					response = new Response(
						JSON.stringify({
							status: 'healthy',
							service: 'email-backend-service',
							account: ACCOUNT,
							port: PORT,
							config: {
								email: process.env.IMAP_USER || process.env.PROTON_EMAIL || null,
								imapHost: process.env.IMAP_HOST || '127.0.0.1',
								imapPort: imapPort,
								smtpHost: process.env.SMTP_HOST || '127.0.0.1',
								smtpPort: smtpPort,
							},
							protonBridge: {
								imap: `localhost:${imapPort}`,
								smtp: `localhost:${smtpPort}`,
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
console.log(`[EMAIL BACKEND] ProtonMail Bridge IMAP: localhost:${process.env.IMAP_PORT || '1145'}`);
console.log(`[EMAIL BACKEND] ProtonMail Bridge SMTP: localhost:${process.env.SMTP_PORT || '1027'}`);
console.log(`[EMAIL BACKEND] Tunnel: mail.mobicycle.productions -> localhost:${PORT}`);
