/**
 * Email Triage Workflow - Unified Workflow (NOT separate workers)
 * All email processing logic in ONE workflow with steps
 */

import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import dashboardHtml from '../1_dashboard/index.html';

// Cloudflare Worker types
interface ScheduledEvent {
	cron: string;
	scheduledTime: number;
}

interface ExecutionContext {
	waitUntil(promise: Promise<any>): void;
	passThroughOnException(): void;
}

interface Env {
	// Workflow binding
	EMAIL_TRIAGE: Workflow;

	// Variables
	TUNNEL_URL: string;
	PROTON_EMAIL: string;

	// All KV namespaces
	EMAIL_COURTS_SUPREME_COURT: KVNamespace;
	EMAIL_COURTS_COURT_OF_APPEALS_CIVIL_DIVISION: KVNamespace;
	EMAIL_COURTS_KINGS_BENCH_APPEALS_DIVISION: KVNamespace;
	EMAIL_COURTS_CHANCERY_DIVISION: KVNamespace;
	EMAIL_COURTS_ADMINISTRATIVE_COURT: KVNamespace;
	EMAIL_COURTS_CENTRAL_LONDON_COUNTY_COURT: KVNamespace;
	EMAIL_COURTS_CLERKENWELL_COUNTY_COURT: KVNamespace;
	EMAIL_COMPLAINTS_ICO: KVNamespace;
	EMAIL_COMPLAINTS_PHSO: KVNamespace;
	EMAIL_COMPLAINTS_PARLIAMENT: KVNamespace;
	EMAIL_COMPLAINTS_HMCTS: KVNamespace;
	EMAIL_COMPLAINTS_BAR_STANDARDS_BOARD: KVNamespace;
	EMAIL_EXPENSES_LEGAL_FEES_CLAIMANT: KVNamespace;
	EMAIL_EXPENSES_LEGAL_FEES_COMPANY: KVNamespace;
	EMAIL_EXPENSES_LEGAL_FEES_DIRECTOR: KVNamespace;
	EMAIL_EXPENSES_REPAIRS: KVNamespace;
	EMAIL_CLAIMANT_HK_LAW: KVNamespace;
	EMAIL_CLAIMANT_LESSEL: KVNamespace;
	EMAIL_CLAIMANT_LIU: KVNamespace;
	EMAIL_CLAIMANT_RENTIFY: KVNamespace;
	EMAIL_DEFENDANTS_DEFENDANT: KVNamespace;
	EMAIL_DEFENDANTS_BOTH_DEFENDANTS: KVNamespace;
	EMAIL_DEFENDANTS_BARRISTERS: KVNamespace;
	EMAIL_DEFENDANTS_LITIGANT_IN_PERSON_ONLY: KVNamespace;
	EMAIL_DEFENDANTS_MOBICYCLE_OU_ONLY: KVNamespace;
	EMAIL_GOVERNMENT_UK_LEGAL_DEPARTMENT: KVNamespace;
	EMAIL_GOVERNMENT_ESTONIA: KVNamespace;
	EMAIL_GOVERNMENT_US_STATE_DEPARTMENT: KVNamespace;
	EMAIL_RECONSIDERATION_SINGLE_JUDGE: KVNamespace;
	EMAIL_RECONSIDERATION_COURT_OFFICER_REVIEW: KVNamespace;
	EMAIL_RECONSIDERATION_CPR52_24_5: KVNamespace;
	EMAIL_RECONSIDERATION_CPR52_24_6: KVNamespace;
	EMAIL_RECONSIDERATION_CPR52_30: KVNamespace;
	EMAIL_RECONSIDERATION_PD52B: KVNamespace;
	EMAIL_RECONSIDERATION_PTA_REFUSAL: KVNamespace;

	// Dashboard snapshots
	DASHBOARD_SCREENSHOTS: KVNamespace;
}

interface Email {
	id: string;
	from: string;
	to: string;
	subject: string;
	body: string;
	date: string;
	messageId: string;
}

interface EmailTriageParams {
	batchId?: string;
	timestamp?: string;
}

export class EmailTriageWorkflow extends WorkflowEntrypoint<Env, EmailTriageParams> {

	async run(event: WorkflowEvent<EmailTriageParams>, step: WorkflowStep) {

		// Step 1: Connect to Protonmail Bridge via tunnel
		const connection = await step.do('connect-protonmail-bridge', async () => {
			const tunnelUrl = this.env.TUNNEL_URL || 'https://imap.mobicycle.ee';
			console.log(`Connecting to Protonmail Bridge at ${tunnelUrl}`);

			const healthCheck = await fetch(`${tunnelUrl}/health`);
			if (!healthCheck.ok) {
				throw new Error(`Protonmail Bridge connection failed: ${healthCheck.status}`);
			}

			const health = await healthCheck.json();
			return { tunnelUrl, connected: true, email: health.config?.email };
		});

		// Step 2: Retrieve emails from Protonmail
		const emails = await step.do('retrieve-emails',
			{ retries: { limit: 3, delay: '10 seconds', backoff: 'exponential' } },
			async () => {
				const response = await fetch(`${connection.tunnelUrl}/fetch-emails`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						account: this.env.PROTON_EMAIL,
						folder: 'INBOX',
						limit: 50,
						unseenOnly: false
					})
				});

				if (!response.ok) {
					throw new Error(`Failed to fetch emails: ${response.status}`);
				}

				const data = await response.json();
				return data.emails || [];
			}
		);

		console.log(`Retrieved ${emails.length} emails`);

		// Step 3: Check whitelist and filter relevant emails
		const relevantEmails = await step.do('filter-whitelist', async () => {
			// Load whitelist (in production, this would be from KV or database)
			// For now, accept all emails from known domains
			const allowedDomains = [
				'.court', '.gov.uk', '.ee', '@ico.org.uk',
				'@ombudsman.org.uk', '@parliament.uk'
			];

			return emails.filter((email: Email) => {
				return allowedDomains.some(domain => email.from.includes(domain));
			});
		});

		console.log(`${relevantEmails.length} emails passed whitelist`);

		// Step 4: Distribute emails to appropriate KV namespaces
		const distributed = await step.do('distribute-to-kv', async () => {
			const results = [];

			for (const email of relevantEmails) {
				// Determine KV namespace based on sender domain
				const kvNamespace = this.getKVNamespaceForEmail(email.from);

				if (kvNamespace) {
					// Generate unique key for email
					const emailKey = this.generateEmailKey(email);

					// Store email in KV
					await kvNamespace.put(emailKey, JSON.stringify(email));

					results.push({
						emailId: email.id,
						from: email.from,
						kvKey: emailKey,
						stored: true
					});
				}
			}

			return results;
		});

		console.log(`Distributed ${distributed.length} emails to KV namespaces`);

		// Step 5: Process each email (triage, classify, etc.)
		for (const result of distributed) {
			const emailId = result.emailId;

			await step.do(`process-${emailId}`, async () => {
				console.log(`Processing email ${emailId}`);
				// Add email processing logic here
				// (classification, case linking, etc.)
				return { processed: true, emailId };
			});
		}

		// Step 6: Log workflow completion
		await step.do('log-completion', async () => {
			return {
				workflowId: event.instanceId,
				completed: new Date().toISOString(),
				emailsRetrieved: emails.length,
				emailsProcessed: distributed.length
			};
		});

		return {
			success: true,
			emailsProcessed: distributed.length
		};
	}

	// Helper: Get KV namespace for email address
	private getKVNamespaceForEmail(emailAddress: string): KVNamespace | null {
		const email = emailAddress.toLowerCase();

		// Courts
		if (email.includes('supremecourt') || email.includes('uksc')) {
			return this.env.EMAIL_COURTS_SUPREME_COURT;
		}
		if (email.includes('admin.court') || email.includes('administrativecourt')) {
			return this.env.EMAIL_COURTS_ADMINISTRATIVE_COURT;
		}
		if (email.includes('chancerydivision')) {
			return this.env.EMAIL_COURTS_CHANCERY_DIVISION;
		}

		// Complaints
		if (email.includes('ico.org.uk')) {
			return this.env.EMAIL_COMPLAINTS_ICO;
		}
		if (email.includes('ombudsman.org.uk')) {
			return this.env.EMAIL_COMPLAINTS_PHSO;
		}
		if (email.includes('parliament.uk')) {
			return this.env.EMAIL_COMPLAINTS_PARLIAMENT;
		}

		// Government
		if (email.includes('.ee') && email.includes('gov')) {
			return this.env.EMAIL_GOVERNMENT_ESTONIA;
		}
		if (email.includes('gov.uk') && email.includes('legal')) {
			return this.env.EMAIL_GOVERNMENT_UK_LEGAL_DEPARTMENT;
		}

		// Default: use a general namespace if available
		return null;
	}

	// Helper: Generate unique email key
	private generateEmailKey(email: Email): string {
		const emailDate = new Date(email.date);
		const year = emailDate.getUTCFullYear();
		const month = (emailDate.getUTCMonth() + 1).toString().padStart(2, '0');
		const day = emailDate.getUTCDate().toString().padStart(2, '0');
		const dateStr = `${year}.${month}.${day}`;
		const hours = emailDate.getUTCHours().toString().padStart(2, '0');
		const minutes = emailDate.getUTCMinutes().toString().padStart(2, '0');
		const senderKey = email.from.replace(/[^a-zA-Z0-9@._-]/g, '_');

		return `${dateStr}_${senderKey}_${hours}:${minutes}`;
	}
}

// Export handler to trigger workflow
export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		// Simple auth check for dashboard access
		const authToken = url.searchParams.get('token');
		const isAuthorized = authToken === 'mobicycle-workflows-2026';

		// Dashboard endpoint
		if (url.pathname === '/dashboard' || url.pathname === '/') {
			if (!isAuthorized) {
				return new Response('Unauthorized', { status: 401 });
			}
			return new Response(generateDashboardHTML(env), {
				headers: { 'Content-Type': 'text/html' }
			});
		}

		// Status API endpoint
		if (url.pathname === '/status') {
			if (!isAuthorized) {
				return new Response('Unauthorized', { status: 401 });
			}
			const status = await getWorkflowStatus(env);
			return new Response(JSON.stringify(status, null, 2), {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Health check endpoint
		if (url.pathname === '/health') {
			if (!isAuthorized) {
				return new Response('Unauthorized', { status: 401 });
			}
			const health = await checkHealth(env);
			return new Response(JSON.stringify(health, null, 2), {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Snapshot endpoint - save current dashboard state to KV
		if (request.method === 'POST' && url.pathname === '/snapshot') {
			if (!isAuthorized) {
				return new Response('Unauthorized', { status: 401 });
			}

			const timestamp = new Date().toISOString();
			const health = await checkHealth(env);
			const status = await getWorkflowStatus(env);

			const snapshot = {
				timestamp,
				health,
				status,
				account: 'MobiCycle OÜ',
				email: env.PROTON_EMAIL
			};

			// Save to KV with timestamp as key
			await env.DASHBOARD_SCREENSHOTS.put(
				timestamp.replace(/:/g, '-'),
				JSON.stringify(snapshot, null, 2)
			);

			return new Response(JSON.stringify({
				saved: true,
				timestamp,
				key: timestamp.replace(/:/g, '-')
			}), {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// List snapshots endpoint
		if (url.pathname === '/snapshots') {
			if (!isAuthorized) {
				return new Response('Unauthorized', { status: 401 });
			}

			const list = await env.DASHBOARD_SCREENSHOTS.list();
			return new Response(JSON.stringify({
				snapshots: list.keys.map(k => k.name),
				count: list.keys.length
			}, null, 2), {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Get specific snapshot
		if (url.pathname.startsWith('/snapshot/')) {
			if (!isAuthorized) {
				return new Response('Unauthorized', { status: 401 });
			}

			const key = url.pathname.replace('/snapshot/', '');
			const snapshot = await env.DASHBOARD_SCREENSHOTS.get(key);

			if (!snapshot) {
				return new Response('Snapshot not found', { status: 404 });
			}

			return new Response(snapshot, {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Trigger workflow
		if (request.method === 'POST' && url.pathname === '/trigger') {
			if (!isAuthorized) {
				return new Response('Unauthorized', { status: 401 });
			}
			const instance = await env.EMAIL_TRIAGE.create({
				params: {
					batchId: crypto.randomUUID(),
					timestamp: new Date().toISOString()
				}
			});

			return new Response(JSON.stringify({
				workflowId: instance.id,
				status: 'started',
				message: 'Email triage workflow started'
			}), {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		return new Response('Method not allowed', { status: 405 });
	},

	// Cron trigger handler - Multi-stage processing
	// Runs every 5 minutes, determines job type based on current time
	// Job types: monitoring (backup), fetching, sorting, categorization
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		const now = new Date();
		const currentMinute = now.getMinutes();
		const currentHour = now.getHours();

		// Determine which job types should run at this time
		const jobTypes: string[] = [];

		// Monitoring job: runs every 4 hours (at hour 0, 4, 8, 12, 16, 20) and minute 0
		if (currentMinute === 0 && currentHour % 4 === 0) {
			jobTypes.push('monitoring');
		}

		// Fetching job: runs every 10 minutes (at minutes 0, 10, 20, 30, 40, 50)
		if (currentMinute % 10 === 0) {
			jobTypes.push('fetching');
		}

		// Sorting job: runs 5 minutes after fetch (at minutes 5, 15, 25, 35, 45, 55)
		if (currentMinute % 10 === 5) {
			jobTypes.push('sorting');
		}

		// Categorization job: runs 8 minutes after fetch (at minutes 8, 18, 28, 38, 48, 58)
		if (currentMinute % 10 === 8) {
			jobTypes.push('categorization');
		}

		console.log('[CRON] Triggered at', now.toISOString(), '| Job types:', jobTypes.join(', ') || 'none');

		// Execute each job type in parallel (if multiple scheduled at same time)
		const jobPromises = jobTypes.map(jobType => executeJob(jobType, env, ctx));
		await Promise.all(jobPromises);

		console.log('[CRON] Completed job types:', jobTypes.join(', '));
	}
};

// Execute a specific job type
async function executeJob(jobType: string, env: Env, ctx: ExecutionContext): Promise<void> {
	const timestamp = new Date().toISOString();
	const jobKey = `job-${jobType}-${timestamp.replace(/:/g, '-')}`;

	try {
		console.log(`[CRON:${jobType.toUpperCase()}] Starting...`);

		// Save job start to KV
		await env.DASHBOARD_SCREENSHOTS.put(
			jobKey,
			JSON.stringify({
				type: 'cron-job-start',
				jobType,
				timestamp,
				status: 'running'
			}),
			{ expirationTtl: 86400 * 7 } // Keep for 7 days
		);

		if (jobType === 'monitoring') {
			await executeMonitoringJob(env);
		} else if (jobType === 'fetching') {
			await executeFetchingJob(env);
		} else if (jobType === 'sorting') {
			await executeSortingJob(env);
		} else if (jobType === 'categorization') {
			await executeCategorizationJob(env);
		}

		// Save job completion
		await env.DASHBOARD_SCREENSHOTS.put(
			jobKey,
			JSON.stringify({
				type: 'cron-job-complete',
				jobType,
				timestamp,
				completedAt: new Date().toISOString(),
				status: 'completed'
			}),
			{ expirationTtl: 86400 * 7 }
		);

		console.log(`[CRON:${jobType.toUpperCase()}] Completed successfully`);

	} catch (error) {
		console.error(`[CRON:${jobType.toUpperCase()}] Failed:`, error);

		// Save job error
		await env.DASHBOARD_SCREENSHOTS.put(
			jobKey,
			JSON.stringify({
				type: 'cron-job-error',
				jobType,
				timestamp,
				failedAt: new Date().toISOString(),
				status: 'failed',
				error: error instanceof Error ? error.message : String(error)
			}),
			{ expirationTtl: 86400 * 7 }
		);
	}
}

// Monitoring Job: Health checks and alerting (backup monitor)
async function executeMonitoringJob(env: Env): Promise<void> {
	try {
		// Check health of Bridge/Tunnel
		const health = await checkHealth(env);

		console.log('[CRON:MONITORING] Health status:', {
			overall: health.overall,
			bridge: health.bridge.status,
			tunnel: health.tunnel.status
		});

		// Get last alert status to avoid flooding
		const lastAlertKey = 'last-alert-status';
		const lastAlert = await env.DASHBOARD_SCREENSHOTS.get(lastAlertKey, { type: 'json' });
		const lastStatus = lastAlert?.status || 'healthy';

		// Only alert if status CHANGED from healthy to degraded/down
		// This prevents flooding - you only get ONE alert when it goes down
		if (health.overall === 'degraded' || health.overall === 'down') {
			// Check if we should send alert (status changed OR been down for 24+ hours)
			const shouldAlert = lastStatus === 'healthy' ||
				(lastAlert?.timestamp &&
				 (Date.now() - new Date(lastAlert.timestamp).getTime()) > 86400000); // 24 hours

			if (shouldAlert) {
				console.warn('[CRON:MONITORING] ⚠️ ALERT: System is', health.overall, '(sending notification)');

				// Save alert snapshot to KV
				const alertTimestamp = new Date().toISOString();
				const alert = {
					type: 'health-alert',
					severity: health.overall === 'down' ? 'critical' : 'warning',
					timestamp: alertTimestamp,
					health,
					message: health.overall === 'down'
						? 'CRITICAL: Email infrastructure is DOWN - Mac/Bridge/Tunnel unreachable'
						: 'WARNING: Email infrastructure is DEGRADED - some components down',
					components: {
						bridge: health.bridge.status,
						tunnel: health.tunnel.status,
						bridgeProcess: health.localDiagnostics.bridgeProcess.running,
						tunnelProcess: health.localDiagnostics.cloudflaredProcess.running
					},
					troubleshooting: health.overall === 'down'
						? 'Check if your Mac is on and connected to the internet. ProtonMail Bridge and Cloudflared tunnel may need to be restarted.'
						: 'Some email infrastructure components are down. Check the dashboard for details.'
				};

				// Store alert in KV with alert- prefix for easy filtering
				await env.DASHBOARD_SCREENSHOTS.put(
					`alert-${alertTimestamp.replace(/:/g, '-')}`,
					JSON.stringify(alert, null, 2),
					{ expirationTtl: 86400 * 7 } // Keep alerts for 7 days
				);

				console.error('[CRON:MONITORING] Alert saved:', alert.message);

				// TODO: Send notification (email, Slack, Discord, etc.)
				// For now, alerts are stored in KV and visible on dashboard
			} else {
				console.log('[CRON:MONITORING] ⚠️ System still', health.overall, '(no new alert - already notified)');
			}

			// Update last alert status
			await env.DASHBOARD_SCREENSHOTS.put(
				lastAlertKey,
				JSON.stringify({
					status: health.overall,
					timestamp: new Date().toISOString()
				}),
				{ expirationTtl: 86400 * 30 }
			);

		} else {
			// System is healthy
			if (lastStatus !== 'healthy') {
				// Status changed from degraded/down to healthy - send recovery notification
				console.log('[CRON:MONITORING] ✅ System RECOVERED to healthy (was', lastStatus + ')');

				const recoveryTimestamp = new Date().toISOString();
				await env.DASHBOARD_SCREENSHOTS.put(
					`recovery-${recoveryTimestamp.replace(/:/g, '-')}`,
					JSON.stringify({
						type: 'recovery',
						timestamp: recoveryTimestamp,
						message: 'Email infrastructure has RECOVERED and is now healthy',
						previousStatus: lastStatus,
						health
					}, null, 2),
					{ expirationTtl: 86400 * 7 }
				);
			} else {
				console.log('[CRON:MONITORING] ✅ System healthy');
			}

			// Update last alert status to healthy
			await env.DASHBOARD_SCREENSHOTS.put(
				lastAlertKey,
				JSON.stringify({
					status: 'healthy',
					timestamp: new Date().toISOString()
				}),
				{ expirationTtl: 86400 * 30 }
			);
		}

		// Auto-save health snapshot every hour
		const currentMinute = new Date().getMinutes();
		if (currentMinute === 0) {
			const snapshot = {
				timestamp: new Date().toISOString(),
				health,
				status: await getWorkflowStatus(env),
				account: 'MobiCycle OÜ',
				email: env.PROTON_EMAIL
			};

			await env.DASHBOARD_SCREENSHOTS.put(
				`auto-${snapshot.timestamp.replace(/:/g, '-')}`,
				JSON.stringify(snapshot, null, 2),
				{ expirationTtl: 86400 * 30 } // Keep auto-snapshots for 30 days
			);

			console.log('[CRON:MONITORING] Auto-snapshot saved');
		}

	} catch (error) {
		console.error('[CRON:MONITORING] Health check failed:', error);
		throw error;
	}
}

// Fetching Job: Fetch new emails from ProtonMail Bridge
async function executeFetchingJob(env: Env): Promise<void> {
	console.log('[CRON:FETCHING] Fetching new emails...');

	try {
		// Fetch emails from ProtonMail Bridge via tunnel
		const response = await fetch(`${env.TUNNEL_URL}/fetch-emails`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				account: env.PROTON_EMAIL,
				folder: 'INBOX',
				limit: 50,
				unseenOnly: false,
				// Option: fetch all or only whitelisted
				// For now, fetch all (filtering happens in sorting job)
				fetchAll: true
			}),
			signal: AbortSignal.timeout(10000)
		});

		if (!response.ok) {
			throw new Error(`Fetch failed: ${response.status}`);
		}

		const data = await response.json() as any;
		const emails = data.emails || [];

		console.log('[CRON:FETCHING] Fetched', emails.length, 'emails');

		// Store fetched emails in a temporary KV namespace for the sorting job
		const fetchTimestamp = new Date().toISOString();
		await env.DASHBOARD_SCREENSHOTS.put(
			`fetch-batch-${fetchTimestamp.replace(/:/g, '-')}`,
			JSON.stringify({
				type: 'fetch-batch',
				timestamp: fetchTimestamp,
				emailCount: emails.length,
				emails: emails.map((e: any) => ({
					id: e.id,
					from: e.from,
					subject: e.subject,
					date: e.date
				}))
			}),
			{ expirationTtl: 3600 } // Keep for 1 hour (sorting job will process)
		);

	} catch (error) {
		console.error('[CRON:FETCHING] Fetch failed:', error);
		throw error;
	}
}

// Sorting Job: Sort fetched emails by sender/type
async function executeSortingJob(env: Env): Promise<void> {
	console.log('[CRON:SORTING] Sorting fetched emails...');

	try {
		// Get the most recent fetch batch
		const list = await env.DASHBOARD_SCREENSHOTS.list({ prefix: 'fetch-batch-' });

		if (list.keys.length === 0) {
			console.log('[CRON:SORTING] No fetch batches to sort');
			return;
		}

		// Get the most recent batch
		const latestBatchKey = list.keys[list.keys.length - 1].name;
		const batchData = await env.DASHBOARD_SCREENSHOTS.get(latestBatchKey, { type: 'json' }) as any;

		if (!batchData || !batchData.emails) {
			console.log('[CRON:SORTING] Batch data invalid or empty');
			return;
		}

		console.log('[CRON:SORTING] Sorting', batchData.emails.length, 'emails from batch', latestBatchKey);

		// Sort emails by whitelisted vs non-whitelisted
		const whitelistedDomains = [
			'.court', '.gov.uk', '.ee', '@ico.org.uk',
			'@ombudsman.org.uk', '@parliament.uk',
			'@hklaw.com', '@lessel.co.uk'
		];

		const sortedEmails = {
			whitelisted: [],
			nonWhitelisted: []
		} as any;

		for (const email of batchData.emails) {
			const from = email.from.toLowerCase();
			const isWhitelisted = whitelistedDomains.some(domain => from.includes(domain));

			if (isWhitelisted) {
				sortedEmails.whitelisted.push(email);
			} else {
				sortedEmails.nonWhitelisted.push(email);
			}
		}

		console.log('[CRON:SORTING] Sorted:', sortedEmails.whitelisted.length, 'whitelisted,', sortedEmails.nonWhitelisted.length, 'non-whitelisted');

		// Store sorted batch for categorization job
		const sortTimestamp = new Date().toISOString();
		await env.DASHBOARD_SCREENSHOTS.put(
			`sort-batch-${sortTimestamp.replace(/:/g, '-')}`,
			JSON.stringify({
				type: 'sort-batch',
				timestamp: sortTimestamp,
				sourceBatch: latestBatchKey,
				whitelistedCount: sortedEmails.whitelisted.length,
				nonWhitelistedCount: sortedEmails.nonWhitelisted.length,
				whitelistedEmails: sortedEmails.whitelisted,
				nonWhitelistedEmails: sortedEmails.nonWhitelisted
			}),
			{ expirationTtl: 3600 } // Keep for 1 hour
		);

	} catch (error) {
		console.error('[CRON:SORTING] Sorting failed:', error);
		throw error;
	}
}

// Categorization Job: Categorize sorted emails into KV namespaces
async function executeCategorizationJob(env: Env): Promise<void> {
	console.log('[CRON:CATEGORIZATION] Categorizing sorted emails...');

	try {
		// Get the most recent sort batch
		const list = await env.DASHBOARD_SCREENSHOTS.list({ prefix: 'sort-batch-' });

		if (list.keys.length === 0) {
			console.log('[CRON:CATEGORIZATION] No sort batches to categorize');
			return;
		}

		// Get the most recent batch
		const latestBatchKey = list.keys[list.keys.length - 1].name;
		const batchData = await env.DASHBOARD_SCREENSHOTS.get(latestBatchKey, { type: 'json' }) as any;

		if (!batchData || !batchData.whitelistedEmails) {
			console.log('[CRON:CATEGORIZATION] Batch data invalid or empty');
			return;
		}

		console.log('[CRON:CATEGORIZATION] Categorizing', batchData.whitelistedCount, 'whitelisted emails from batch', latestBatchKey);

		// Only process whitelisted emails (non-whitelisted are ignored/archived)
		let categorized = 0;
		for (const email of batchData.whitelistedEmails) {
			// TODO: Implement categorization logic
			// For now, just log
			console.log('[CRON:CATEGORIZATION] Would categorize:', email.from, '-', email.subject);
			categorized++;
		}

		// Store categorization results
		const categorizeTimestamp = new Date().toISOString();
		await env.DASHBOARD_SCREENSHOTS.put(
			`categorize-batch-${categorizeTimestamp.replace(/:/g, '-')}`,
			JSON.stringify({
				type: 'categorize-batch',
				timestamp: categorizeTimestamp,
				sourceBatch: latestBatchKey,
				categorizedCount: categorized
			}),
			{ expirationTtl: 86400 * 7 } // Keep for 7 days
		);

		console.log('[CRON:CATEGORIZATION] Categorized', categorized, 'emails');

	} catch (error) {
		console.error('[CRON:CATEGORIZATION] Categorization failed:', error);
		throw error;
	}
}

// Check health of all dependencies
async function checkHealth(env: Env) {
	const checks = {
		timestamp: new Date().toISOString(),
		bridge: { running: false, status: 'unknown', error: null as string | null },
		tunnel: { up: false, status: 'unknown', error: null as string | null },
		tunnelConfig: { valid: false, url: env.TUNNEL_URL },
		tunnelUrl: env.TUNNEL_URL,
		protonEmail: env.PROTON_EMAIL,
		kvNamespaces: 35,
		overall: 'unknown',
		diagnostics: null as any,
		localDiagnostics: {
			bridgeProcess: { running: false, pid: null },
			imapPort: { listening: false, port: 1143 },
			smtpPort: { listening: false, port: 1025 },
			cloudflaredProcess: { running: false, pid: null },
			cloudflaredConfig: { valid: false, routes: [] }
		}
	};

	// 1. Check if tunnel URL is configured
	if (env.TUNNEL_URL && env.TUNNEL_URL.startsWith('https://')) {
		checks.tunnelConfig.valid = true;
	} else {
		checks.tunnelConfig.valid = false;
	}

	// 2. Check if tunnel is up (reachable)
	try {
		const tunnelCheck = await fetch(env.TUNNEL_URL, {
			signal: AbortSignal.timeout(3000)
		});
		checks.tunnel.up = true;
		checks.tunnel.status = 'reachable';
	} catch (error) {
		checks.tunnel.up = false;
		checks.tunnel.status = 'down';
		checks.tunnel.error = (error as Error).message;
	}

	// 3. Check if ProtonMail Bridge is running (via /health endpoint)
	if (checks.tunnel.up) {
		try {
			const bridgeCheck = await fetch(`${env.TUNNEL_URL}/health`, {
				signal: AbortSignal.timeout(5000)
			});
			if (bridgeCheck.ok) {
				const data = await bridgeCheck.json() as any;
				checks.bridge.running = true;
				checks.bridge.status = 'running';
			} else {
				checks.bridge.running = false;

				// Detailed HTTP error diagnosis
				if (bridgeCheck.status === 530) {
					checks.bridge.status = 'bridge process not running';
					checks.bridge.error = 'HTTP 530 - Cloudflare cannot reach origin. Possible causes: (1) ProtonMail Bridge CLI not started, (2) Bridge listening on wrong port (expected 1143), (3) Cloudflared tunnel not pointing to localhost:1143, (4) Firewall blocking local connection';
				} else if (bridgeCheck.status === 502) {
					checks.bridge.status = 'bridge connection refused';
					checks.bridge.error = 'HTTP 502 - Bad Gateway. Bridge process may have crashed or port mismatch between tunnel config and bridge listening port';
				} else if (bridgeCheck.status === 504) {
					checks.bridge.status = 'bridge timeout';
					checks.bridge.error = 'HTTP 504 - Gateway timeout. Bridge taking too long to respond (>30s typical). Check bridge logs for performance issues';
				} else if (bridgeCheck.status === 403) {
					checks.bridge.status = 'bridge authentication failed';
					checks.bridge.error = 'HTTP 403 - Forbidden. Bridge may require authentication or tunnel credentials are invalid';
				} else {
					checks.bridge.status = 'bridge error';
					checks.bridge.error = `HTTP ${bridgeCheck.status} - Unexpected error from ProtonMail Bridge`;
				}
			}
		} catch (error) {
			checks.bridge.running = false;
			checks.bridge.status = 'bridge unreachable';
			checks.bridge.error = `Network error: ${(error as Error).message}. Check if cloudflared tunnel is running and routing to correct local port`;
		}

		// 3b. Fetch local diagnostics (process status, port listeners)
		try {
			const diagCheck = await fetch(`${env.TUNNEL_URL}/diagnostics`, {
				signal: AbortSignal.timeout(5000)
			});
			if (diagCheck.ok) {
				checks.diagnostics = await diagCheck.json();

				// Populate localDiagnostics from diagnostics endpoint
				if (checks.diagnostics?.bridge) {
					checks.localDiagnostics.bridgeProcess = checks.diagnostics.bridge.process || { running: false, pid: null };
					checks.localDiagnostics.imapPort = checks.diagnostics.bridge.imapPort || { listening: false, port: 1143 };
					checks.localDiagnostics.smtpPort = checks.diagnostics.bridge.smtpPort || { listening: false, port: 1025 };
				}
				if (checks.diagnostics?.cloudflared) {
					checks.localDiagnostics.cloudflaredProcess = checks.diagnostics.cloudflared.process || { running: false, pid: null };
					checks.localDiagnostics.cloudflaredConfig = checks.diagnostics.cloudflared.config || { valid: false, routes: [] };
				}
			}
		} catch (error) {
			// Diagnostics endpoint not available or errored - not critical
			console.log('Diagnostics endpoint unavailable:', (error as Error).message);
		}
	} else {
		checks.bridge.status = 'tunnel down - cannot check bridge';
		checks.bridge.error = 'Cloudflare Tunnel is not reachable, so ProtonMail Bridge status cannot be determined';
	}

	// Overall status - be VERY specific about what's healthy
	// "healthy" = ALL components working (tunnel, bridge HTTP, diagnostics with process checks)
	// "degraded" = tunnel + bridge HTTP working but diagnostics incomplete
	// "down" = tunnel or bridge HTTP not working

	const hasFullDiagnostics = checks.diagnostics !== null &&
		checks.localDiagnostics.bridgeProcess.running &&
		checks.localDiagnostics.cloudflaredProcess.running;

	if (checks.tunnelConfig.valid && checks.tunnel.up && checks.bridge.running && hasFullDiagnostics) {
		checks.overall = 'healthy';
	} else if (checks.tunnelConfig.valid && checks.tunnel.up && checks.bridge.running) {
		checks.overall = 'degraded'; // HTTP endpoints work but diagnostics incomplete
	} else {
		checks.overall = 'down';
	}

	return checks;
}

// Get workflow status
async function getWorkflowStatus(env: Env) {
	return {
		workflow: 'email-triage',
		account: 'MobiCycle OÜ',
		configuration: {
			tunnelUrl: env.TUNNEL_URL,
			protonEmail: env.PROTON_EMAIL,
			kvNamespaces: 35,
			r2Buckets: 2
		},
		steps: [
			{ id: 1, name: 'connect-protonmail-bridge', description: 'Connect to ProtonMail Bridge via tunnel' },
			{ id: 2, name: 'retrieve-emails', description: 'Fetch emails from INBOX' },
			{ id: 3, name: 'filter-whitelist', description: 'Filter emails by allowed domains' },
			{ id: 4, name: 'distribute-to-kv', description: 'Store emails in appropriate KV namespaces' },
			{ id: 5, name: 'process-emails', description: 'Classify and link emails to cases' },
			{ id: 6, name: 'log-completion', description: 'Record workflow completion' }
		]
	};
}

// Generate dashboard HTML
function generateDashboardHTML(env: Env): string {
	return dashboardHtml;
}
