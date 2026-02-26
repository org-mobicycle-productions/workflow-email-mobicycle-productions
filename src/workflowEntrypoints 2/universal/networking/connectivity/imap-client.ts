/**
 * IMAP Client - ProtonMail Bridge Integration
 * Connects to ProtonMail Bridge on localhost:1143 to fetch emails.
 *
 * ProtonMail Bridge exposes IMAP on port 1143 (STARTTLS).
 * Credentials are stored in environment variables or ProtonMail Bridge config.
 *
 * The workflow fetches UNSEEN emails — ProtonMail Bridge tracks read/unread
 * state via IMAP flags, so each workflow run only picks up new mail.
 * Once fetched, emails are marked as SEEN so the next run skips them.
 */

import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

function getRequiredEnv(name: string, value: string | undefined): string {
	if (value && value.trim()) return value.trim();
	throw new Error(`Missing required environment variable: ${name}`);
}

function getEnvInt(name: string, value: string | undefined, fallback: number): number {
	if (!value) return fallback;
	const parsed = Number.parseInt(value, 10);
	if (Number.isFinite(parsed)) return parsed;
	throw new Error(`Invalid integer for environment variable ${name}: ${value}`);
}

// ProtonMail Bridge connection settings
const IMAP_HOST = process.env.IMAP_HOST || '127.0.0.1';
const IMAP_PORT = getEnvInt('IMAP_PORT', process.env.IMAP_PORT, 1143);
const IMAP_USER = getRequiredEnv('IMAP_USER', process.env.IMAP_USER || process.env.PROTON_EMAIL);
const IMAP_PASS = getRequiredEnv(
	'IMAP_PASS',
	process.env.IMAP_PASS || process.env.PROTON_BRIDGE_PASSWORD || process.env.PROTONMAIL_BRIDGE_PASSWORD
);

export interface FetchEmailsRequest {
	account: string;
	unseenOnly?: boolean;
	// Backward/forward compatible naming:
	// - Worker sends `folder`
	// - Internal code uses `mailbox`
	folder?: string;
	mailbox?: string;
	limit?: number;
}

export interface EmailMessage {
	id: string;
	from: string;
	to: string;
	subject: string;
	body: string;
	date: string;
	messageId: string;
}

export interface MailboxSummary {
	path: string;
	specialUse?: string;
	messages?: number;
	unseen?: number;
}

/**
 * Create an IMAP connection to ProtonMail Bridge
 */
function createImapClient(): ImapFlow {
	return new ImapFlow({
		host: IMAP_HOST,
		port: IMAP_PORT,
		secure: false, // ProtonMail Bridge uses STARTTLS on 1143
		auth: {
			user: IMAP_USER,
			pass: IMAP_PASS,
		},
		tls: {
			rejectUnauthorized: false, // ProtonMail Bridge uses self-signed certs
		},
		logger: false,
	});
}

/**
 * Fetch emails from ProtonMail Bridge via IMAP.
 * By default fetches UNSEEN (unread) emails only — the natural deduplication
 * mechanism. Each email is marked SEEN after fetch so the next workflow run
 * won't pick it up again.
 */
export async function fetchEmails(request: FetchEmailsRequest): Promise<EmailMessage[]> {
	const unseenOnly = request.unseenOnly ?? true;
	const mailbox = request.mailbox || request.folder || 'INBOX';
	const limit = request.limit ?? 500;

	console.log(`[IMAP] Fetching ${unseenOnly ? 'unseen' : 'all'} emails from ${mailbox}, limit ${limit}`);

	const client = createImapClient();
	const emails: EmailMessage[] = [];

	try {
		await client.connect();
		console.log('[IMAP] Connected to ProtonMail Bridge');

		// Open the mailbox
		const mailboxInfo = await client.mailboxOpen(mailbox);
		console.log(`[IMAP] Opened ${mailbox}: ${mailboxInfo.exists} messages total`);

		// Search: unseen only (default) or all messages
		// ProtonMail Bridge has limited IMAP search support, so we use simple criteria
		const searchCriteria = unseenOnly ? { seen: false } : {};
		const searchResults = await client.search(searchCriteria);

		console.log(`[IMAP] Found ${searchResults.length} ${unseenOnly ? 'unseen' : 'total'} messages`);

		if (searchResults.length === 0) {
			console.log('[IMAP] No messages to fetch');
			return [];
		}

		// Fetch a larger batch to sort by date (fetch last 200 UIDs max)
		const batchSize = Math.min(500, searchResults.length);
		const messageUids = searchResults.slice(-batchSize);

		// Fetch each message
		for (const uid of messageUids) {
			try {
				const message = await client.fetchOne(uid, {
					source: true,
					envelope: true,
					uid: true,
				});

				if (message.source) {
					const parsed = await simpleParser(message.source);

					const fromAddress =
						parsed.from?.value?.[0]?.address || parsed.from?.text || 'unknown';
					const toAddress = parsed.to?.value?.[0]?.address || parsed.to?.text || '';

					emails.push({
						id: `${uid}`,
						from: fromAddress,
						to: toAddress,
						subject: parsed.subject || '(No Subject)',
						body: parsed.text || parsed.html || '',
						date: (parsed.date || new Date()).toISOString(),
						messageId: parsed.messageId || `<${uid}@protonmail.bridge>`,
					});
				}

				// Mark as SEEN so subsequent runs skip this email
				if (unseenOnly) {
					await client.messageFlagsAdd(uid, ['\\Seen']);
				}
			} catch (msgError: any) {
				console.error(`[IMAP] Error fetching message ${uid}:`, msgError.message);
			}
		}

		console.log(`[IMAP] Successfully fetched ${emails.length} emails`);

		// Sort by date descending (most recent first)
		emails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

		// Return only the requested limit (most recent)
		const limitedEmails = emails.slice(0, limit);
		console.log(`[IMAP] Returning ${limitedEmails.length} most recent emails`);

		return limitedEmails;
	} catch (error: any) {
		console.error('[IMAP] Connection error:', error.message);
		throw new Error(`IMAP fetch failed: ${error.message}`);
	} finally {
		try {
			await client.logout();
		} catch {
			// Ignore logout errors
		}
	}
}

/**
 * List all IMAP mailboxes and include message/unseen counts (if supported).
 */
export async function listMailboxes(): Promise<MailboxSummary[]> {
	console.log('[IMAP] Listing mailboxes');

	const client = createImapClient();

	try {
		await client.connect();
		const list = await client.list({ statusQuery: { messages: true, unseen: true } });

		const mailboxes: MailboxSummary[] = list
			.map((mb) => ({
				path: mb.path,
				specialUse: mb.specialUse,
				messages: mb.status?.messages,
				unseen: mb.status?.unseen,
			}))
			.sort((a, b) => a.path.localeCompare(b.path));

		console.log(`[IMAP] Listed ${mailboxes.length} mailboxes`);
		return mailboxes;
	} catch (error: any) {
		console.error('[IMAP] List error:', error.message);
		throw new Error(`IMAP list failed: ${error.message}`);
	} finally {
		try {
			await client.logout();
		} catch {
			// Ignore logout errors
		}
	}
}

/**
 * Get total email count from a mailbox
 */
export async function getEmailCount(mailbox: string = 'INBOX'): Promise<number> {
	console.log(`[IMAP] Getting total email count from ${mailbox}`);

	const client = createImapClient();

	try {
		await client.connect();
		console.log('[IMAP] Connected to ProtonMail Bridge');

		// Open the mailbox
		const mailboxInfo = await client.mailboxOpen(mailbox);
		const totalCount = mailboxInfo.exists;

		console.log(`[IMAP] Total messages in ${mailbox}: ${totalCount}`);

		return totalCount;
	} catch (error: any) {
		console.error('[IMAP] Connection error:', error.message);
		throw new Error(`IMAP count failed: ${error.message}`);
	} finally {
		try {
			await client.logout();
		} catch {
			// Ignore logout errors
		}
	}
}
