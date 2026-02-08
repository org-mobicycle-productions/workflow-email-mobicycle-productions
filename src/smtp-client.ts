/**
 * SMTP Client - ProtonMail Bridge Integration
 * Connects to ProtonMail Bridge on localhost:1025 to send emails.
 *
 * ProtonMail Bridge exposes SMTP on port 1025 (STARTTLS).
 */

import nodemailer from 'nodemailer';

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

// ProtonMail Bridge SMTP settings
const SMTP_HOST = process.env.SMTP_HOST || '127.0.0.1';
const SMTP_PORT = getEnvInt('SMTP_PORT', process.env.SMTP_PORT, 1025);
const SMTP_USER = getRequiredEnv('SMTP_USER', process.env.SMTP_USER || process.env.PROTON_EMAIL);
const SMTP_PASS = getRequiredEnv(
	'SMTP_PASS',
	process.env.SMTP_PASS || process.env.PROTON_BRIDGE_PASSWORD || process.env.PROTONMAIL_BRIDGE_PASSWORD
);

export interface SendEmailRequest {
	from: string;
	to: string;
	subject: string;
	text?: string;
	html?: string;
	references?: string;
	inReplyTo?: string;
	attachments?: Array<{
		filename: string;
		content: string; // base64 encoded
		contentType?: string;
	}>;
}

export interface SendEmailResult {
	success: boolean;
	messageId?: string;
	error?: string;
	timestamp: string;
}

/**
 * Create an SMTP transport using ProtonMail Bridge
 */
function createTransport(): nodemailer.Transporter {
	return nodemailer.createTransport({
		host: SMTP_HOST,
		port: SMTP_PORT,
		secure: false, // ProtonMail Bridge uses STARTTLS on 1025
		auth: {
			user: SMTP_USER,
			pass: SMTP_PASS,
		},
		tls: {
			rejectUnauthorized: false, // ProtonMail Bridge uses self-signed certs
		},
	});
}

/**
 * Send an email via ProtonMail Bridge SMTP
 */
export async function sendEmail(request: SendEmailRequest): Promise<SendEmailResult> {
	console.log(`[SMTP] Sending email from ${request.from} to ${request.to}: "${request.subject}"`);

	const transport = createTransport();

	try {
		const mailOptions: nodemailer.SendMailOptions = {
			from: request.from,
			to: request.to,
			subject: request.subject,
			text: request.text,
			html: request.html,
			references: request.references,
			inReplyTo: request.inReplyTo,
		};

		// Handle attachments
		if (request.attachments && request.attachments.length > 0) {
			mailOptions.attachments = request.attachments.map((att) => ({
				filename: att.filename,
				content: Buffer.from(att.content, 'base64'),
				contentType: att.contentType,
			}));
		}

		const info = await transport.sendMail(mailOptions);

		console.log(`[SMTP] Email sent successfully: ${info.messageId}`);

		return {
			success: true,
			messageId: info.messageId,
			timestamp: new Date().toISOString(),
		};
	} catch (error: any) {
		console.error('[SMTP] Send error:', error.message);
		return {
			success: false,
			error: error.message,
			timestamp: new Date().toISOString(),
		};
	} finally {
		transport.close();
	}
}
