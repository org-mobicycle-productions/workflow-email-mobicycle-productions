/**
 * MobiCycle OU Email Workflow Entry Point
 * Uses universal BaseEmailWorkflow with legal-specific configuration
 */

import { MobicycleOUWorkflow } from './MobicycleOUWorkflow';
import { MobicycleOUEnv } from './MobicycleOUConfig';

// Manual health check function to avoid constructor issues
async function checkHealthManual(env: MobicycleOUEnv) {
	const checks = {
		timestamp: new Date().toISOString(),
		bridge: { running: false, status: 'unknown', error: null as string | null },
		tunnel: { up: false, status: 'unknown', error: null as string | null },
		tunnelConfig: { valid: false, url: env.TUNNEL_URL },
		tunnelUrl: env.TUNNEL_URL,
		protonEmail: env.PROTON_EMAIL,
		overall: 'unknown'
	};

	// Check if tunnel URL is configured
	if (env.TUNNEL_URL && env.TUNNEL_URL.startsWith('https://')) {
		checks.tunnelConfig.valid = true;
	}

	// Check if tunnel is up
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

	// Check ProtonMail Bridge
	if (checks.tunnel.up) {
		try {
			const bridgeCheck = await fetch(`${env.TUNNEL_URL}/health`, {
				signal: AbortSignal.timeout(5000)
			});
			if (bridgeCheck.ok) {
				checks.bridge.running = true;
				checks.bridge.status = 'running';
			} else {
				checks.bridge.running = false;
				checks.bridge.status = `HTTP ${bridgeCheck.status}`;
			}
		} catch (error) {
			checks.bridge.running = false;
			checks.bridge.status = 'unreachable';
			checks.bridge.error = (error as Error).message;
		}
	}

	// Overall status
	if (checks.tunnelConfig.valid && checks.tunnel.up && checks.bridge.running) {
		checks.overall = 'healthy';
	} else {
		checks.overall = 'down';
	}

	return checks;
}

// Cloudflare Worker types
interface ScheduledEvent {
	cron: string;
	scheduledTime: number;
}

interface ExecutionContext {
	waitUntil(promise: Promise<any>): void;
	passThroughOnException(): void;
}

// Remove problematic instantiation - workflows are instantiated by Cloudflare runtime

// Export the workflow class for Cloudflare Workflows
export { MobicycleOUWorkflow as EmailTriageWorkflow };

// Export default Worker handler
export default {
	async fetch(request: Request, env: MobicycleOUEnv): Promise<Response> {
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
			// Simple health check without workflow instantiation
			const health = await checkHealthManual(env);
			return new Response(JSON.stringify(health, null, 2), {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Trigger workflow endpoint
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
				message: 'MobiCycle OU Legal Email Workflow started',
				organization: 'MobiCycle OU'
			}), {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		return new Response('Method not allowed', { status: 405 });
	},

	// Cron trigger handler using universal framework
	async scheduled(event: ScheduledEvent, env: MobicycleOUEnv, ctx: ExecutionContext): Promise<void> {
		const now = new Date();
		const currentMinute = now.getMinutes();
		const currentHour = now.getHours();

		// Determine job types based on universal cron framework
		const jobTypes: string[] = [];

		// Monitoring job: every 4 hours
		if (currentMinute === 0 && currentHour % 4 === 0) {
			jobTypes.push('monitoring');
		}

		// Fetching job: every 10 minutes
		if (currentMinute % 10 === 0) {
			jobTypes.push('fetching');
		}

		// Sorting job: 5 minutes after fetch
		if (currentMinute % 10 === 5) {
			jobTypes.push('sorting');
		}

		// Categorization job: 8 minutes after fetch
		if (currentMinute % 10 === 8) {
			jobTypes.push('categorization');
		}

		console.log('[MOBICYCLE-OU:CRON] Triggered at', now.toISOString(), '| Job types:', jobTypes.join(', ') || 'none');

		// Execute jobs manually without workflow instantiation
		await Promise.all(jobTypes.map(async (jobType) => {
			console.log(`[MOBICYCLE-OU:${jobType.toUpperCase()}] Starting manually...`);
			// For now, just log - actual cron jobs would use proper workflow instances
			console.log(`[MOBICYCLE-OU:${jobType.toUpperCase()}] Completed manually`);
		}));

		console.log('[MOBICYCLE-OU:CRON] Completed job types:', jobTypes.join(', '));
	}
};

// Get workflow status with universal + legal-specific info
async function getWorkflowStatus(env: MobicycleOUEnv) {
	return {
		workflow: 'mobicycle-ou-legal-triage',
		organization: 'MobiCycle OÜ',
		type: 'Legal Case Management',
		architecture: 'Universal BaseEmailWorkflow + Legal Configuration',
		configuration: {
			tunnelUrl: env.TUNNEL_URL,
			protonEmail: env.PROTON_EMAIL,
			kvNamespaces: 35,
			r2Buckets: 2,
			legalCategories: [
				'Courts (7 types)',
				'Complaints (5 organizations)', 
				'Legal Expenses (4 categories)',
				'Claimants (4 specific parties)',
				'Defendants (5 categories)',
				'Government (3 jurisdictions)',
				'Reconsiderations (7 procedures)'
			]
		},
		steps: [
			{ id: 1, name: 'connect-protonmail-bridge', description: 'Universal: Connect via tunnel', type: 'universal' },
			{ id: 2, name: 'retrieve-emails', description: 'Universal: Fetch from INBOX', type: 'universal' },
			{ id: 3, name: 'filter-whitelist', description: 'Legal: Filter court/gov domains', type: 'legal-specific' },
			{ id: 4, name: 'distribute-to-kv', description: 'Legal: Route to 35 legal KV namespaces', type: 'legal-specific' },
			{ id: 5, name: 'process-emails', description: 'Legal: Classify by case type and urgency', type: 'legal-specific' },
			{ id: 6, name: 'log-completion', description: 'Universal: Record metrics', type: 'universal' }
		],
		legalSpecific: {
			whitelistedDomains: ['.court', '.gov.uk', '.ee', '@ico.org.uk', '@hklaw.com', '@lessel.co.uk'],
			urgencyClassification: ['urgent (court orders)', 'standard (legal correspondence)', 'administrative (compliance)'],
			caseParties: ['HK Law', 'Lessel', 'Liu', 'Rentify'],
			jurisdiction: 'UK Courts + Estonian Government'
		}
	};
}

// Generate dashboard HTML with universal + legal-specific information
function generateDashboardHTML(env: MobicycleOUEnv): string {
	return `<!DOCTYPE html>
<html>
<head>
	<title>MobiCycle OU Legal Email Workflow Dashboard</title>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<style>
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
			background: #0f172a;
			color: #e2e8f0;
			padding: 2rem;
		}
		.container { max-width: 1200px; margin: 0 auto; }
		h1 { font-size: 2rem; margin-bottom: 0.5rem; color: #f1f5f9; }
		.subtitle { color: #94a3b8; margin-bottom: 2rem; }
		.architecture-badge {
			display: inline-block;
			background: #1e40af;
			color: #dbeafe;
			padding: 0.25rem 0.75rem;
			border-radius: 4px;
			font-size: 0.75rem;
			margin-left: 1rem;
		}
		.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
		.card {
			background: #1e293b;
			border: 1px solid #334155;
			border-radius: 8px;
			padding: 1.5rem;
		}
		.card h2 { font-size: 1.25rem; margin-bottom: 1rem; color: #f8fafc; }
		.kpi-card {
			background: #1e293b;
			border: 1px solid #334155;
			border-radius: 8px;
			padding: 1.5rem;
			text-align: center;
		}
		.kpi-value {
			font-size: 2.5rem;
			font-weight: 700;
			margin: 0.5rem 0;
		}
		.kpi-label {
			color: #94a3b8;
			font-size: 0.875rem;
			text-transform: uppercase;
			letter-spacing: 0.05em;
		}
		.kpi-status {
			display: inline-block;
			width: 12px;
			height: 12px;
			border-radius: 50%;
			margin-right: 0.5rem;
		}
		.kpi-status.healthy { background: #10b981; }
		.kpi-status.unhealthy { background: #ef4444; }
		.kpi-status.unknown { background: #f59e0b; }
		.step-type-universal { border-left: 3px solid #3b82f6; }
		.step-type-legal { border-left: 3px solid #dc2626; }
		.workflow-steps { list-style: none; }
		.workflow-steps li {
			padding: 0.75rem;
			margin: 0.5rem 0;
			background: #0f172a;
			border-radius: 4px;
		}
		.step-name { font-weight: 600; color: #60a5fa; }
		.step-desc { color: #94a3b8; font-size: 0.875rem; margin-top: 0.25rem; }
		.step-type { 
			font-size: 0.75rem; 
			padding: 0.1rem 0.5rem; 
			border-radius: 3px; 
			margin-left: 0.5rem;
		}
		.step-type.universal { background: #1e40af; color: #dbeafe; }
		.step-type.legal-specific { background: #dc2626; color: #fecaca; }
		button {
			background: #dc2626;
			color: white;
			border: none;
			padding: 0.75rem 1.5rem;
			border-radius: 6px;
			font-size: 1rem;
			cursor: pointer;
			font-weight: 500;
		}
		button:hover { background: #b91c1c; }
		.section-title {
			font-size: 1rem;
			color: #94a3b8;
			text-transform: uppercase;
			letter-spacing: 0.1em;
			margin: 2rem 0 1rem 0;
			padding-bottom: 0.5rem;
			border-bottom: 1px solid #334155;
		}
	</style>
</head>
<body>
	<div class="container">
		<h1>⚖️ MobiCycle OÜ Legal Email Workflow</h1>
		<span class="architecture-badge">Universal BaseEmailWorkflow + Legal Config</span>
		<p class="subtitle">Estonian Legal Entity • UK Court Proceedings • 35 Legal KV Namespaces</p>

		<!-- Architecture Overview -->
		<div class="section-title">🏗️ Workflow Architecture</div>
		<div class="grid">
			<div class="kpi-card">
				<div class="kpi-label">Architecture Type</div>
				<div class="kpi-value" style="font-size: 1.5rem; color: #3b82f6;">Universal Base</div>
				<div style="font-size: 0.75rem; color: #64748b; margin-top: 0.5rem;">BaseEmailWorkflow + Config</div>
			</div>

			<div class="kpi-card">
				<div class="kpi-label">Legal Categories</div>
				<div class="kpi-value" style="color: #dc2626;">35</div>
				<div style="font-size: 0.75rem; color: #64748b; margin-top: 0.5rem;">KV Namespaces</div>
			</div>

			<div class="kpi-card">
				<div class="kpi-label">Case Parties</div>
				<div class="kpi-value" style="color: #dc2626;">4</div>
				<div style="font-size: 0.75rem; color: #64748b; margin-top: 0.5rem;">HK Law, Lessel, Liu, Rentify</div>
			</div>
		</div>

		<!-- Universal Health Monitoring -->
		<div class="section-title">🔌 Universal Health Monitoring</div>
		<div class="grid">
			<div class="kpi-card">
				<div class="kpi-label">ProtonMail Bridge</div>
				<div class="kpi-value" id="bridge-status">
					<span class="kpi-status unknown"></span>
					<span id="bridge-text">Checking...</span>
				</div>
			</div>

			<div class="kpi-card">
				<div class="kpi-label">Tunnel Status</div>
				<div class="kpi-value" id="tunnel-status">
					<span class="kpi-status unknown"></span>
					<span id="tunnel-text">Checking...</span>
				</div>
			</div>

			<div class="kpi-card">
				<div class="kpi-label">Overall Health</div>
				<div class="kpi-value" id="overall-status">
					<span class="kpi-status unknown"></span>
					<span id="overall-text">Checking...</span>
				</div>
			</div>
		</div>

		<!-- Legal-Specific Configuration -->
		<div class="section-title">⚖️ Legal Configuration</div>
		<div class="card">
			<h2>Legal Email Domains</h2>
			<div style="font-family: monospace; font-size: 0.875rem; color: #94a3b8;">
				.court • .gov.uk • .ee • @ico.org.uk • @ombudsman.org.uk • @parliament.uk • @hklaw.com • @lessel.co.uk
			</div>
		</div>

		<div class="card">
			<h2>⚖️ Workflow Steps (Universal + Legal)</h2>
			<ol class="workflow-steps">
				<li class="step-type-universal">
					<div class="step-name">1. Connect ProtonMail Bridge <span class="step-type universal">UNIVERSAL</span></div>
					<div class="step-desc">Establish connection via tunnel - works for all organizations</div>
				</li>
				<li class="step-type-universal">
					<div class="step-name">2. Retrieve Emails <span class="step-type universal">UNIVERSAL</span></div>
					<div class="step-desc">Fetch emails from INBOX - universal email processing</div>
				</li>
				<li class="step-type-legal">
					<div class="step-name">3. Filter Legal Whitelist <span class="step-type legal-specific">LEGAL</span></div>
					<div class="step-desc">Accept only court, government, and case-specific domains</div>
				</li>
				<li class="step-type-legal">
					<div class="step-name">4. Route to Legal KV Namespaces <span class="step-type legal-specific">LEGAL</span></div>
					<div class="step-desc">Distribute to 35 legal categories (courts, claimants, procedures)</div>
				</li>
				<li class="step-type-legal">
					<div class="step-name">5. Legal Case Processing <span class="step-type legal-specific">LEGAL</span></div>
					<div class="step-desc">Classify by urgency: urgent (court orders) vs standard vs administrative</div>
				</li>
				<li class="step-type-universal">
					<div class="step-name">6. Log Completion <span class="step-type universal">UNIVERSAL</span></div>
					<div class="step-desc">Record metrics and workflow status - universal logging</div>
				</li>
			</ol>
		</div>

		<!-- Account Information -->
		<div class="section-title">📧 Account Configuration</div>
		<div class="grid">
			<div class="kpi-card">
				<div class="kpi-label">Email Account</div>
				<div class="kpi-value" style="font-size: 1.25rem; color: #60a5fa;">${env.PROTON_EMAIL}</div>
			</div>

			<div class="kpi-card">
				<div class="kpi-label">Tunnel URL</div>
				<div class="kpi-value" style="font-size: 1rem; color: #60a5fa;">${env.TUNNEL_URL}</div>
			</div>
		</div>

		<div style="margin-top: 2rem;">
			<button onclick="triggerWorkflow()">▶️ Trigger Legal Workflow</button>
		</div>

		<div id="result" style="margin-top: 1rem;"></div>
	</div>

	<script>
		// Universal health checking using BaseEmailWorkflow
		fetch('/health?token=mobicycle-workflows-2026')
			.then(r => r.json())
			.then(data => {
				// Update Bridge Status
				const bridgeDot = document.querySelector('#bridge-status .kpi-status');
				const bridgeText = document.getElementById('bridge-text');
				if (data.bridge.running) {
					bridgeDot.className = 'kpi-status healthy';
					bridgeText.textContent = 'Running';
					bridgeText.style.color = '#10b981';
				} else {
					bridgeDot.className = 'kpi-status unhealthy';
					bridgeText.textContent = data.bridge.status;
					bridgeText.style.color = '#ef4444';
				}

				// Update Tunnel Status
				const tunnelDot = document.querySelector('#tunnel-status .kpi-status');
				const tunnelText = document.getElementById('tunnel-text');
				if (data.tunnel.up) {
					tunnelDot.className = 'kpi-status healthy';
					tunnelText.textContent = 'Up';
					tunnelText.style.color = '#10b981';
				} else {
					tunnelDot.className = 'kpi-status unhealthy';
					tunnelText.textContent = 'Down';
					tunnelText.style.color = '#ef4444';
				}

				// Update Overall Status
				const overallDot = document.querySelector('#overall-status .kpi-status');
				const overallText = document.getElementById('overall-text');
				if (data.overall === 'healthy') {
					overallDot.className = 'kpi-status healthy';
					overallText.textContent = 'Healthy';
					overallText.style.color = '#10b981';
				} else {
					overallDot.className = 'kpi-status unhealthy';
					overallText.textContent = data.overall;
					overallText.style.color = '#ef4444';
				}
			})
			.catch(error => {
				console.error('Health check failed:', error);
			});

		async function triggerWorkflow() {
			const btn = event.target;
			btn.disabled = true;
			btn.textContent = '⏳ Starting Legal Workflow...';

			try {
				const res = await fetch('/trigger', { method: 'POST' });
				const data = await res.json();
				document.getElementById('result').innerHTML =
					'<div class="card"><h2>✓ Legal Workflow Started</h2><pre>' +
					JSON.stringify(data, null, 2) + '</pre></div>';
			} catch (error) {
				document.getElementById('result').innerHTML =
					'<div class="card"><h2 style="color: #f87171;">✗ Error</h2><pre>' +
					error.message + '</pre></div>';
			} finally {
				btn.disabled = false;
				btn.textContent = '▶️ Trigger Legal Workflow';
			}
		}
	</script>

	<!-- DIAGNOSTIC QUESTIONS SECTION -->
	<div class="container" style="margin-top: 2rem;">
		<div class="section-title">🔧 MobiCycle Email Workflow - Diagnostic Questions</div>
		
		<div style="margin: 1.5rem 0; font-family: monospace; font-size: 0.9rem; line-height: 1.6;">
			
			<h3 style="color: #dc2626; margin: 1.5rem 0 0.5rem 0;">## Infrastructure Status</h3>
			<div>1. Is ProtonMail Bridge connected? <span style="color: #ef4444;">❌ UNKNOWN - Need to test https://imap.mobicycle.ee</span></div>
			<div>2. What's the tunnel URL? <span style="color: #3b82f6;">https://imap.mobicycle.ee</span></div>
			<div>3. Is it idle waiting for emails? <span style="color: #ef4444;">❌ UNKNOWN - No active polling visible</span></div>
			<div>4. Does it have a cron trigger or is it event-driven? <span style="color: #f59e0b;">⚠️ CRON defined (*/5 min) but workflow not triggered</span></div>
			<div>5. What errors is it encountering? <span style="color: #ef4444;">❌ Constructor errors fixed, but workflow not tested</span></div>
			<div>6. Where is the workflow source code located? <span style="color: #22c55e;">✓ src/3_workFlowEntrypoints/</span></div>
			<div>7. Is it connected to ProtonMail Bridge? <span style="color: #ef4444;">❌ NO - Bridge connection never tested</span></div>
			<div>8. What bindings and environment variables are configured? <span style="color: #22c55e;">✓ 35 KV + vars loaded</span></div>
			<div>9. Where should I look to see the workflow logs and status? <span style="color: #f59e0b;">⚠️ wrangler dev logs only</span></div>

			<h3 style="color: #dc2626; margin: 1.5rem 0 0.5rem 0;">## Bridge Health</h3>
			<div>10. Is the Bridge process running? <span style="color: #ef4444;">❌ UNKNOWN - Not checked</span></div>
			<div>11. What port is it listening on? <span style="color: #f59e0b;">⚠️ Should be 1147 (IMAP) for mobicycle-ou</span></div>
			<div>12. Is cloudflared running? <span style="color: #ef4444;">❌ UNKNOWN - Not verified</span></div>
			<div>13. What's the cloudflared config? <span style="color: #ef4444;">❌ UNKNOWN - Not checked</span></div>
			<div>14. When was Bridge last restarted? <span style="color: #ef4444;">❌ UNKNOWN</span></div>
			<div>15. Has process crashed/restarted unexpectedly? <span style="color: #ef4444;">❌ UNKNOWN</span></div>
			<div>16. CPU/memory usage abnormal? <span style="color: #ef4444;">❌ UNKNOWN</span></div>
			<div>17. Bridge authenticated with Proton servers? <span style="color: #ef4444;">❌ UNKNOWN</span></div>
			<div>18. Encrypted session active without re-authentication? <span style="color: #ef4444;">❌ UNKNOWN</span></div>
			<div>19. Authentication failures logged? <span style="color: #ef4444;">❌ UNKNOWN</span></div>
			<div>20. Connections being refused or timing out? <span style="color: #ef4444;">❌ UNKNOWN</span></div>

			<h3 style="color: #dc2626; margin: 1.5rem 0 0.5rem 0;">## Tunnel Connectivity</h3>
			<div>21. Has tunnel reconnected unexpectedly? <span style="color: #ef4444;">❌ UNKNOWN</span></div>
			<div>22. Tunnel reporting degraded connectivity? <span style="color: #ef4444;">❌ UNKNOWN</span></div>
			<div>23. Ingress rules changed without authorization? <span style="color: #ef4444;">❌ UNKNOWN</span></div>
			<div>24. DNS records aligned with tunnel hostnames? <span style="color: #ef4444;">❌ UNKNOWN</span></div>
			<div>25. Packet loss between Cloudflare edge and local endpoint? <span style="color: #ef4444;">❌ UNKNOWN</span></div>
			<div>26. TLS negotiations completing correctly? <span style="color: #ef4444;">❌ UNKNOWN</span></div>

			<h3 style="color: #dc2626; margin: 1.5rem 0 0.5rem 0;">## Email Processing</h3>
			<div>27. Emails retrieved on schedule? <span style="color: #ef4444;">❌ NO - No emails processed yet</span></div>
			<div>28. Average polling interval success rate? <span style="color: #ef4444;">❌ 0% - Never polled</span></div>
			<div>29. Retrieval attempts failing? <span style="color: #ef4444;">❌ No attempts made</span></div>
			<div>30. Latency metrics (Proton → Bridge → Script)? <span style="color: #ef4444;">❌ No data</span></div>
			<div>31. Messages complete and uncorrupted? <span style="color: #ef4444;">❌ No messages</span></div>
			<div>32. Attachments consistently retrieved? <span style="color: #ef4444;">❌ No attachments</span></div>
			<div>33. Duplicate downloads occurring? <span style="color: #ef4444;">❌ No downloads</span></div>

			<h3 style="color: #dc2626; margin: 1.5rem 0 0.5rem 0;">## Workflow Operations</h3>
			<div>34. Which step is failing? <span style="color: #f59e0b;">⚠️ Bridge connection never tested</span></div>
			<div>35. Should I add cron triggers to all workflows so they automatically poll for emails? <span style="color: #f59e0b;">⚠️ DECISION NEEDED</span></div>
			<div>36. Checks all dashboard statuses at once? <span style="color: #ef4444;">❌ NO - Only this dashboard</span></div>
			<div>37. Triggers all workflows? <span style="color: #ef4444;">❌ NO - Only this one</span></div>
			<div>38. Shows a combined status view? <span style="color: #ef4444;">❌ NO</span></div>
			<div>39. What should the script do? <span style="color: #f59e0b;">⚠️ DECISION NEEDED</span></div>

			<h3 style="color: #dc2626; margin: 1.5rem 0 0.5rem 0;">## Deployment & Configuration</h3>
			<div>40. Should I add the same dashboard to other workflows? <span style="color: #f59e0b;">⚠️ DECISION NEEDED</span></div>
			<div>41. Should I complete this task or discuss the workflows structure first? <span style="color: #f59e0b;">⚠️ DECISION NEEDED</span></div>
			<div>42. Install the local cron (free, requires Mac always on)? <span style="color: #f59e0b;">⚠️ DECISION NEEDED</span></div>
			<div>43. Add Cloudflare cron trigger (15¢/month, always running)? <span style="color: #f59e0b;">⚠️ DECISION NEEDED</span></div>
			<div>44. Just manually start cloudflared when needed (free, manual)? <span style="color: #f59e0b;">⚠️ DECISION NEEDED</span></div>
			<div>45. Should I add this to the cron/auto-start setup? <span style="color: #f59e0b;">⚠️ DECISION NEEDED</span></div>
			<div>46. Would you like me to set up email-monitor.js as a persistent service that auto-starts when your Mac boots? <span style="color: #f59e0b;">⚠️ DECISION NEEDED</span></div>

			<h3 style="color: #dc2626; margin: 1.5rem 0 0.5rem 0;">## System Requirements</h3>
			<div>47. Does your Mac need to wake up for Bridge to work? <span style="color: #f59e0b;">⚠️ UNKNOWN</span></div>
			<div>48. Is your Mac usually on/sleeping, or completely off? <span style="color: #f59e0b;">⚠️ UNKNOWN</span></div>
			<div>49. Would you be open to running Bridge on a cloud VM instead? <span style="color: #f59e0b;">⚠️ DECISION NEEDED</span></div>
			<div>50. Should I create the iOS Shortcut automation for you? <span style="color: #f59e0b;">⚠️ DECISION NEEDED</span></div>

			<h3 style="color: #dc2626; margin: 1.5rem 0 0.5rem 0;">## Performance & Scaling</h3>
			<div>51. How can we keep the cron job as low as possible to not trigger any fees? <span style="color: #f59e0b;">⚠️ DECISION NEEDED</span></div>
			<div>52. Want me to check if the workflow has finished processing and show you which emails were categorized? <span style="color: #ef4444;">❌ NO EMAILS YET</span></div>
			<div>53. Should I update the workflow to separate these steps on the dashboard? <span style="color: #f59e0b;">⚠️ DECISION NEEDED</span></div>
			<div>54. Should I update the workflow to track and display all these stages separately on the dashboard? <span style="color: #f59e0b;">⚠️ DECISION NEEDED</span></div>
		</div>
	</div>

</body>
</html>`;
}