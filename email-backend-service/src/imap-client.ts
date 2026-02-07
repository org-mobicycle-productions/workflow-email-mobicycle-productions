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

// ProtonMail Bridge connection settings
const IMAP_HOST = 'localhost';
const IMAP_PORT = 1143;
const IMAP_USER = 'rose@mobicycle.productions';
const IMAP_PASS = 'yeMDbia0cJ45IWvsphn4fA';

export interface FetchEmailsRequest {
	account: string;
	unseenOnly?: boolean;
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
	const { unseenOnly = true, mailbox = 'INBOX', limit = 50 } = request;

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
		const searchCriteria = unseenOnly ? { seen: false } : {};
		const searchResults = await client.search(searchCriteria);

		console.log(`[IMAP] Found ${searchResults.length} ${unseenOnly ? 'unseen' : 'total'} messages`);

		if (searchResults.length === 0) {
			console.log('[IMAP] No messages to fetch');
			return [];
		}

		// Take the most recent messages up to limit
		const messageUids = searchResults.slice(-limit);

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

	return emails;
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
