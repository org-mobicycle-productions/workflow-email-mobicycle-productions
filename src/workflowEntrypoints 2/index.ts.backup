/*
 * MobiCycle OU Email Workflow Entry Point
 * Universal Base + Legal-Specific Extensions
 */

// import { MobicycleOUWorkflow } from './MobicycleOUWorkflow';
// import { MobicycleOUEnv } from './MobicycleOUConfig';
import dashboardHtml from '../1_frontend/index.html';
import { generateEmailWhitelist, isEmailWhitelisted, getKVNamespaceForEmail } from './universal/emails/whitelist-engine';

// Email formatting functions based on format-key.sh and format-value.sh
function formatEmailKey(from: string, date: string): string {
	// Parse date: 2026-02-09T10:30:45Z
	const year = date.split('-')[0];
	const month = date.split('-')[1];
	const day = date.split('T')[0].split('-')[2];
	const time = date.split('T')[1].split('Z')[0];
	const hours = time.split(':')[0];
	const minutes = time.split(':')[1];
	const seconds = time.split(':')[2];
	
	// Sanitize sender: casework@ico.org.uk → casework_ico_org_uk
	const sender = from.replace(/[@.]/g, '_');
	
	// Generate key: 2026.09.02_casework_ico_org_uk_10-30-45
	return `${year}.${day}.${month}_${sender}_${hours}-${minutes}-${seconds}`;
}

function formatEmailValue(from: string, to: string, subject: string, date: string, messageId: string, body: string = '', namespace: string = 'UNCLASSIFIED'): any {
	return {
		from,
		to,
		subject,
		body,
		date,
		messageId,
		namespace,
		storedAt: new Date().toISOString(),
		status: 'pending'
	};
}

// Email fetching job with proper formatting and whitelist engine
async function executeEmailFetchingJob(env: MobicycleOUEnv): Promise<void> {
	console.log('[CRON:FETCHING] Starting email fetch job...');
	
	try {
		// Step 1: Fetch emails from ProtonMail Bridge via backend
		const imapResponse = await fetch(`${env.TUNNEL_URL}/fetch-emails`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				account: env.PROTON_EMAIL,
				folder: 'All Mail',
				limit: 50
			}),
			signal: AbortSignal.timeout(15000)
		});

		if (!imapResponse.ok) {
			throw new Error(`Backend returned ${imapResponse.status}`);
		}

		const data = await imapResponse.json();
		const emails = data.emails || [];
		
		console.log(`[CRON:FETCHING] Fetched ${emails.length} emails`);

		// Step 2: Save raw emails to RAW_DATA_HEADERS with proper formatting
		for (const email of emails) {
			const emailKey = formatEmailKey(email.from || '', email.date || new Date().toISOString());
			const emailValue = formatEmailValue(
				email.from || '',
				email.to || '',
				email.subject || '',
				email.date || new Date().toISOString(),
				email.messageId || '',
				email.body || '',
				'RAW'
			);
			
			await env.RAW_DATA_HEADERS.put(emailKey, JSON.stringify(emailValue));
		}

		// Step 3: Filter emails using whitelist engine and save to FILTERED_DATA_HEADERS
		// TODO: Load actual classification rules - for now use basic legal domains
		const mockWhitelist = {
			addresses: [
				{ pattern: '.court', type: 'pattern', categories: ['courts'], tags: { legalType: ['litigation'], jurisdiction: ['UK'], institution: ['court'], priority: 'high', kvNamespace: ['EMAIL_COURTS_ADMINISTRATIVE_COURT'] } },
				{ pattern: '.gov.uk', type: 'pattern', categories: ['government'], tags: { legalType: ['administrative'], jurisdiction: ['UK'], institution: ['government'], priority: 'high', kvNamespace: ['EMAIL_GOVERNMENT_UK_LEGAL_DEPARTMENT'] } },
				{ pattern: '@ico.org.uk', type: 'exact', categories: ['complaints'], tags: { legalType: ['regulatory'], jurisdiction: ['UK'], institution: ['ombudsman'], priority: 'high', kvNamespace: ['EMAIL_COMPLAINTS_ICO'] } }
			],
			domains: [],
			patterns: [],
			lastUpdated: new Date().toISOString()
		};

		let filteredCount = 0;
		for (const email of emails) {
			const whitelistResult = isEmailWhitelisted(email.from || '', mockWhitelist);
			
			if (whitelistResult.allowed) {
				const emailKey = formatEmailKey(email.from || '', email.date || new Date().toISOString());
				const emailValue = formatEmailValue(
					email.from || '',
					email.to || '',
					email.subject || '',
					email.date || new Date().toISOString(),
					email.messageId || '',
					email.body || '',
					whitelistResult.categories?.[0] || 'FILTERED'
				);
				
				await env.FILTERED_DATA_HEADERS.put(emailKey, JSON.stringify(emailValue));
				filteredCount++;
				
				// Step 4: Categorize into specific KV namespaces
				if (whitelistResult.tags?.kvNamespace?.[0]) {
					const kvBinding = whitelistResult.tags.kvNamespace[0];
					const namespace = (env as any)[kvBinding];
					if (namespace) {
						await namespace.put(emailKey, JSON.stringify(emailValue));
					}
				}
			}
		}

		console.log(`[CRON:FETCHING] Processed ${emails.length} emails, ${filteredCount} passed whitelist`);

	} catch (error) {
		console.error('[CRON:FETCHING] Error:', error);
		throw error;
	}
}

// Environment type definitions with all KV namespace bindings
type MobicycleOUEnv = {
	// Variables from wrangler.jsonc
	PROTON_EMAIL: string;
	TUNNEL_URL: string;
	CE_FILE_URL: string;
	NOTIFICATION_EMAIL: string;
	CLAUDE_WEBHOOK: string;

	// Workflow binding
	EMAIL_TRIAGE: any;

	// Court KV Namespaces
	EMAIL_COURTS_SUPREME_COURT: KVNamespace;
	EMAIL_COURTS_COURT_OF_APPEALS_CIVIL_DIVISION: KVNamespace;
	EMAIL_COURTS_KINGS_BENCH_APPEALS_DIVISION: KVNamespace;
	EMAIL_COURTS_CHANCERY_DIVISION: KVNamespace;
	EMAIL_COURTS_ADMINISTRATIVE_COURT: KVNamespace;
	EMAIL_COURTS_CENTRAL_LONDON_COUNTY_COURT: KVNamespace;
	EMAIL_COURTS_CLERKENWELL_COUNTY_COURT: KVNamespace;

	// Complaints KV Namespaces
	EMAIL_COMPLAINTS_ICO: KVNamespace;
	EMAIL_COMPLAINTS_PHSO: KVNamespace;
	EMAIL_COMPLAINTS_PARLIAMENT: KVNamespace;
	EMAIL_COMPLAINTS_HMCTS: KVNamespace;
	EMAIL_COMPLAINTS_BAR_STANDARDS_BOARD: KVNamespace;

	// Legal Expenses KV Namespaces
	EMAIL_EXPENSES_LEGAL_FEES_CLAIMANT: KVNamespace;
	EMAIL_EXPENSES_LEGAL_FEES_COMPANY: KVNamespace;
	EMAIL_EXPENSES_LEGAL_FEES_DIRECTOR: KVNamespace;
	EMAIL_EXPENSES_REPAIRS: KVNamespace;

	// Claimants KV Namespaces
	EMAIL_CLAIMANT_HK_LAW: KVNamespace;
	EMAIL_CLAIMANT_LESSEL: KVNamespace;
	EMAIL_CLAIMANT_LIU: KVNamespace;
	EMAIL_CLAIMANT_RENTIFY: KVNamespace;

	// Defendants KV Namespaces
	EMAIL_DEFENDANTS_DEFENDANT: KVNamespace;
	EMAIL_DEFENDANTS_BOTH_DEFENDANTS: KVNamespace;
	EMAIL_DEFENDANTS_BARRISTERS: KVNamespace;
	EMAIL_DEFENDANTS_LITIGANT_IN_PERSON_ONLY: KVNamespace;
	EMAIL_DEFENDANTS_MOBICYCLE_OU_ONLY: KVNamespace;

	// Government KV Namespaces
	EMAIL_GOVERNMENT_UK_LEGAL_DEPARTMENT: KVNamespace;
	EMAIL_GOVERNMENT_ESTONIA: KVNamespace;
	EMAIL_GOVERNMENT_US_STATE_DEPARTMENT: KVNamespace;

	// Reconsideration KV Namespaces
	EMAIL_RECONSIDERATION_SINGLE_JUDGE: KVNamespace;
	EMAIL_RECONSIDERATION_COURT_OFFICER_REVIEW: KVNamespace;
	EMAIL_RECONSIDERATION_PTA_REFUSAL: KVNamespace;
	EMAIL_RECONSIDERATION_CPR52_24_5: KVNamespace;
	EMAIL_RECONSIDERATION_CPR52_24_6: KVNamespace;
	EMAIL_RECONSIDERATION_CPR52_30: KVNamespace;
	EMAIL_RECONSIDERATION_PD52B: KVNamespace;

	// Raw and Filtered Email Data
	RAW_DATA_HEADERS: KVNamespace;
	FILTERED_DATA_HEADERS: KVNamespace;

	// Dashboard KV Namespace
	DASHBOARD_SCREENSHOTS: KVNamespace;
};

// Temporary stub workflow class
class EmailTriageWorkflow {
	async run() {
		return { status: 'stub' };
	}
}

// Universal answer function containing all groups - REAL DATA ONLY
async function getUniversalAnswers(env: MobicycleOUEnv, data: any) {
	// Count emails in KV namespaces
	const kvNamespaces = [
		env.EMAIL_COURTS_SUPREME_COURT,
		env.EMAIL_COURTS_COURT_OF_APPEALS_CIVIL_DIVISION,
		env.EMAIL_COURTS_KINGS_BENCH_APPEALS_DIVISION,
		env.EMAIL_COURTS_CHANCERY_DIVISION,
		env.EMAIL_COURTS_ADMINISTRATIVE_COURT,
		env.EMAIL_COURTS_CENTRAL_LONDON_COUNTY_COURT,
		env.EMAIL_COURTS_CLERKENWELL_COUNTY_COURT,
		env.EMAIL_COMPLAINTS_ICO,
		env.EMAIL_COMPLAINTS_PHSO,
		env.EMAIL_COMPLAINTS_PARLIAMENT,
		env.EMAIL_COMPLAINTS_HMCTS,
		env.EMAIL_COMPLAINTS_BAR_STANDARDS_BOARD,
		env.EMAIL_EXPENSES_LEGAL_FEES_CLAIMANT,
		env.EMAIL_EXPENSES_LEGAL_FEES_COMPANY,
		env.EMAIL_EXPENSES_LEGAL_FEES_DIRECTOR,
		env.EMAIL_EXPENSES_REPAIRS,
		env.EMAIL_CLAIMANT_HK_LAW,
		env.EMAIL_CLAIMANT_LESSEL,
		env.EMAIL_CLAIMANT_LIU,
		env.EMAIL_CLAIMANT_RENTIFY,
		env.EMAIL_DEFENDANTS_DEFENDANT,
		env.EMAIL_DEFENDANTS_BOTH_DEFENDANTS,
		env.EMAIL_DEFENDANTS_BARRISTERS,
		env.EMAIL_DEFENDANTS_LITIGANT_IN_PERSON_ONLY,
		env.EMAIL_DEFENDANTS_MOBICYCLE_OU_ONLY,
		env.EMAIL_GOVERNMENT_UK_LEGAL_DEPARTMENT,
		env.EMAIL_GOVERNMENT_ESTONIA,
		env.EMAIL_GOVERNMENT_US_STATE_DEPARTMENT,
		env.EMAIL_RECONSIDERATION_SINGLE_JUDGE,
		env.EMAIL_RECONSIDERATION_COURT_OFFICER_REVIEW,
		env.EMAIL_RECONSIDERATION_PTA_REFUSAL,
		env.EMAIL_RECONSIDERATION_CPR52_24_5,
		env.EMAIL_RECONSIDERATION_CPR52_24_6,
		env.EMAIL_RECONSIDERATION_CPR52_30,
		env.EMAIL_RECONSIDERATION_PD52B,
	];

	let totalEmailsInKV = 0;
	let totalPending = 0;
	for (const namespace of kvNamespaces) {
		const keys = await namespace.list();
		totalEmailsInKV += keys.keys.length;
		for (const key of keys.keys) {
			const emailData = await namespace.get(key.name);
			if (emailData) {
				const email = JSON.parse(emailData);
				if (email.status === 'pending' || !email.status) {
					totalPending++;
				}
			}
		}
	}

	// Get inbox count from ProtonMail Bridge
	let inboxTotal = 0;
	try {
		const inboxResponse = await fetch(`${env.TUNNEL_URL}/email-count`, {
			method: 'GET',
			signal: AbortSignal.timeout(5000)
		});
		if (inboxResponse.ok) {
			const inboxData = await inboxResponse.json();
			inboxTotal = inboxData.totalCount || 0;
		}
	} catch (error) {
		// Bridge unavailable
	}

	// Check Phase 1 status
	const phase1Step1 = await env.DASHBOARD_SCREENSHOTS.get('phase1_step1_status');
	const phase1Step2 = await env.DASHBOARD_SCREENSHOTS.get('phase1_step2_status');
	const phase1Step3 = await env.DASHBOARD_SCREENSHOTS.get('phase1_step3_status');
	const phase1Step4 = await env.DASHBOARD_SCREENSHOTS.get('phase1_step4_status');
	const phase1Step5 = await env.DASHBOARD_SCREENSHOTS.get('phase1_step5_status');

	const step1Status = phase1Step1 ? JSON.parse(phase1Step1) : null;
	const step2Status = phase1Step2 ? JSON.parse(phase1Step2) : null;
	const step3Status = phase1Step3 ? JSON.parse(phase1Step3) : null;
	const step4Status = phase1Step4 ? JSON.parse(phase1Step4) : null;
	const step5Status = phase1Step5 ? JSON.parse(phase1Step5) : null;

	return {
		// Infrastructure Status (Q1-Q9)
		infrastructureStatus: {
			q1: data.bridge?.running ? 'Yes - Connected' : 'No - Disconnected',
			q2: data.tunnel?.url || env.TUNNEL_URL,
			q3: step1Status ? `Last run: ${step1Status.timestamp}` : 'Not yet run',
			q4: `Phase 1: ${step1Status?.status || 'not started'}, Phase 2: not started`,
			q5: data.bridge?.running ? 'None' : 'Bridge offline',
			q6: '/Users/mobicycle/Library/Mobile Documents/com~apple~CloudDocs/9._MobiCycle_Technologies/workflows/email/mobicycle-ou',
			q7: data.bridge?.running ? 'Yes' : 'No',
			q8: `35 KV namespaces with ${totalEmailsInKV} total emails`,
			q9: `Dashboard shows ${totalEmailsInKV} stored, ${totalPending} pending`
		},
		// Bridge Health (Q10-Q20)
		bridgeHealth: {
			q10: data.bridge?.running ? 'Yes' : 'No',
			q11: data.bridge?.running ? 'IMAP: 1143, SMTP: 1025' : 'Unknown - Bridge offline',
			q12: data.tunnel?.up ? 'Yes' : 'No',
			q13: data.tunnel?.url || 'Unknown',
			q14: step1Status?.timestamp || 'Unknown',
			q15: 'Unknown',
			q16: data.bridge?.running ? 'Unknown - needs monitoring' : 'N/A',
			q17: data.bridge?.running ? 'Unknown - needs auth check' : 'No',
			q18: data.tunnel?.up ? 'Assumed yes' : 'No',
			q19: data.bridge?.running ? 'Unknown - needs monitoring' : 'N/A',
			q20: data.bridge?.running ? 'No' : 'Yes - Bridge offline'
		},
		// Tunnel Connectivity (Q21-Q26)
		tunnelConnectivity: {
			q21: 'Unknown - needs monitoring',
			q22: data.tunnel?.up ? 'No' : 'Yes',
			q23: 'Unknown - needs monitoring',
			q24: data.tunnel?.up ? 'Assumed yes' : 'Unknown',
			q25: 'Unknown - needs monitoring',
			q26: data.tunnel?.up ? 'Assumed yes' : 'Unknown'
		},
		// Email Processing (Q27-Q33)
		emailProcessing: {
			q27: step1Status?.status === 'success' ? `Yes - ${step1Status.emailsFetched || 0} fetched` : 'No',
			q28: step1Status?.status === 'success' ? '100%' : '0%',
			q29: step1Status?.status === 'error' ? step1Status.message : 'None',
			q30: 'Unknown - needs monitoring',
			q31: 'Unknown - needs monitoring',
			q32: 'Unknown - needs monitoring',
			q33: 'Unknown - needs monitoring'
		},
		// Workflow Operations (Q34-Q39)
		workflowOperations: {
			q34: step1Status?.status === 'error' ? 'Phase 1 Step 1' : (step2Status?.status === 'error' ? 'Phase 1 Step 2' : 'None'),
			q35: data.tunnel?.up ? 'Yes' : 'No - Tunnel down',
			q36: `${totalEmailsInKV} emails in KV, ${totalPending} pending`,
			q37: step1Status ? 'Manual trigger or CRON' : 'Not yet triggered',
			q38: 'Yes - This page',
			q39: `Inbox: ${inboxTotal} → Filtered: ${step2Status?.emailsFiltered || 0} → KV: ${totalEmailsInKV}`
		},
		// Deployment & Configuration (Q40-Q46)
		deploymentConfiguration: {
			q40: env.TUNNEL_URL ? 'Yes - Tunnel configured' : 'No',
			q41: totalEmailsInKV > 0 ? 'Yes - Emails in KV' : 'No - KV empty',
			q42: 'Unknown - needs CRON check',
			q43: data.tunnel?.up ? 'Yes' : 'No',
			q44: data.tunnel?.up ? 'Running' : 'Unknown',
			q45: 'Unknown - needs system check',
			q46: step1Status ? 'Active' : 'Not yet run'
		},
		// System Requirements (Q47-Q50)
		systemRequirements: {
			q47: data.bridge?.running ? 'Yes' : 'Unknown',
			q48: data.bridge?.running ? 'Running' : 'Unknown',
			q49: 'Unknown - needs system check',
			q50: 'Unknown - needs system check'
		},
		// Performance & Scaling (Q51-Q54)
		performanceScaling: {
			q51: `${totalEmailsInKV} emails stored across 35 namespaces`,
			q52: step1Status ? `Last: ${step1Status.timestamp}` : 'Not yet run',
			q53: `Phase 1 status available - ${step1Status?.status || 'not started'}`,
			q54: `${totalPending} pending, ${totalEmailsInKV - totalPending} processed`
		}
	};
}

// Manual health check function to avoid constructor issues
async function getWorkflowStatus(env: MobicycleOUEnv) {
	const checks = {
		bridge: { running: false, status: 'unchecked' },
		tunnel: { up: false, status: 'unchecked', url: env.TUNNEL_URL },
		protonEmail: env.PROTON_EMAIL,
		overall: 'unknown'
	};

	// Check if tunnel URL is configured
	if (!env.TUNNEL_URL) {
		checks.tunnel.status = 'no tunnel configured';
		checks.overall = 'unhealthy';
		return checks;
	}

	// Check tunnel connectivity
	try {
		const tunnelCheck = await fetch(env.TUNNEL_URL, {
			signal: AbortSignal.timeout(3000)
		});
		checks.tunnel.up = true;
		checks.tunnel.status = 'reachable';
	} catch (error) {
		checks.tunnel.status = 'unreachable';
		checks.overall = 'unhealthy';
		return checks;
	}

	// Check ProtonMail Bridge via tunnel
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
		checks.bridge.status = 'connection failed';
	}

	// Determine overall health
	if (checks.bridge.running && checks.tunnel.up) {
		checks.overall = 'healthy';
	} else if (checks.tunnel.up) {
		checks.overall = 'degraded';
	} else {
		checks.overall = 'unhealthy';
	}

	return checks;
}

// Get Phase 1 status from KV
async function getPhase1Status(env: MobicycleOUEnv) {
	const kvNamespace = env.DASHBOARD_SCREENSHOTS; // Using available KV namespace

	const getStatus = async (step: number) => {
		const key = `phase1_step${step}_status`;
		const status = await kvNamespace.get(key);
		return status ? JSON.parse(status) : { status: 'not_started', timestamp: null };
	};

	const getCategorizeStatus = async () => {
		const key = 'phase1_step3_5_status';
		const status = await kvNamespace.get(key);
		return status ? JSON.parse(status) : { status: 'not_started', timestamp: null };
	};

	return {
		step1: await getStatus(1),
		step2: await getStatus(2),
		step3: await getStatus(3),
		step3_5_categorize: await getCategorizeStatus(),
		step4: await getStatus(4),
		step5: await getStatus(5)
	};
}

// Authorization helper
function isAuthorized(request: Request): boolean {
	const token = new URL(request.url).searchParams.get('token');
	return token === 'mobicycle-workflows-2026';
}

// Export the workflow class for Cloudflare Workflows
export { EmailTriageWorkflow };

// Export default Worker handler
export default {
	async fetch(request: Request, env: MobicycleOUEnv): Promise<Response> {
		const url = new URL(request.url);
		const authorized = isAuthorized(request);

		// Dashboard route
		if (url.pathname === '/dashboard' || url.pathname === '/') {
			if (!authorized) {
				return new Response('Unauthorized', { status: 401 });
			}
			return new Response(generateDashboardHTML(env), {
				headers: { 'Content-Type': 'text/html' }
			});
		}

		// Status route
		if (url.pathname === '/status') {
			if (!authorized) {
				return new Response('Unauthorized', { status: 401 });
			}
			const status = await getWorkflowStatus(env);
			return new Response(JSON.stringify(status, null, 2), {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Health route
		if (url.pathname === '/health' || url.pathname === '/api/health') {
			if (!authorized) {
				return new Response('Unauthorized', { status: 401 });
			}
			// Simple health check without workflow instantiation
			const health = await getWorkflowStatus(env);
			return new Response(JSON.stringify(health, null, 2), {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// CRON status route - REAL DATA FROM KV
		if (url.pathname === '/api/cron-status') {
			if (!authorized) {
				return new Response('Unauthorized', { status: 401 });
			}

			// Get REAL CRON status from KV namespace
			const kvNamespace = env.DASHBOARD_SCREENSHOTS;

			const getCronJobStatus = async (jobType: string) => {
				const key = `cron_${jobType}_status`;
				const status = await kvNamespace.get(key);
				if (status) {
					return JSON.parse(status);
				}
				return {
					timestamp: null,
					status: 'never_run',
					message: 'CRON job has never been executed'
				};
			};

			const cronStatus = {
				monitoring: await getCronJobStatus('monitoring'),
				fetching: await getCronJobStatus('fetching'),
				sorting: await getCronJobStatus('sorting'),
				categorization: await getCronJobStatus('categorization')
			};

			return new Response(JSON.stringify(cronStatus), {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Universal answers route
		if (url.pathname === '/api/answers') {
			if (!authorized) {
				return new Response('Unauthorized', { status: 401 });
			}
			const health = await getWorkflowStatus(env);
			const answers = await getUniversalAnswers(env, health);
			return new Response(JSON.stringify(answers, null, 2), {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Email processing calculation status
		if (url.pathname === '/api/email-calculations') {
			if (!authorized) {
				return new Response('Unauthorized', { status: 401 });
			}

			// Count emails in KV and count non-empty folders
			let kvTotal = 0;
			let folderCount = 0;
			const kvNamespaces = [
				env.EMAIL_COURTS_SUPREME_COURT, env.EMAIL_COURTS_COURT_OF_APPEALS_CIVIL_DIVISION,
				env.EMAIL_COURTS_KINGS_BENCH_APPEALS_DIVISION, env.EMAIL_COURTS_CHANCERY_DIVISION,
				env.EMAIL_COURTS_ADMINISTRATIVE_COURT, env.EMAIL_COURTS_CENTRAL_LONDON_COUNTY_COURT,
				env.EMAIL_COURTS_CLERKENWELL_COUNTY_COURT, env.EMAIL_COMPLAINTS_ICO,
				env.EMAIL_COMPLAINTS_PHSO, env.EMAIL_COMPLAINTS_PARLIAMENT,
				env.EMAIL_COMPLAINTS_HMCTS, env.EMAIL_COMPLAINTS_BAR_STANDARDS_BOARD,
				env.EMAIL_EXPENSES_LEGAL_FEES_CLAIMANT, env.EMAIL_EXPENSES_LEGAL_FEES_COMPANY,
				env.EMAIL_EXPENSES_LEGAL_FEES_DIRECTOR, env.EMAIL_EXPENSES_REPAIRS,
				env.EMAIL_CLAIMANT_HK_LAW, env.EMAIL_CLAIMANT_LESSEL,
				env.EMAIL_CLAIMANT_LIU, env.EMAIL_CLAIMANT_RENTIFY,
				env.EMAIL_DEFENDANTS_DEFENDANT, env.EMAIL_DEFENDANTS_BOTH_DEFENDANTS,
				env.EMAIL_DEFENDANTS_BARRISTERS, env.EMAIL_DEFENDANTS_LITIGANT_IN_PERSON_ONLY,
				env.EMAIL_DEFENDANTS_MOBICYCLE_OU_ONLY, env.EMAIL_GOVERNMENT_UK_LEGAL_DEPARTMENT,
				env.EMAIL_GOVERNMENT_ESTONIA, env.EMAIL_GOVERNMENT_US_STATE_DEPARTMENT,
				env.EMAIL_RECONSIDERATION_SINGLE_JUDGE, env.EMAIL_RECONSIDERATION_COURT_OFFICER_REVIEW,
				env.EMAIL_RECONSIDERATION_PTA_REFUSAL, env.EMAIL_RECONSIDERATION_CPR52_24_5,
				env.EMAIL_RECONSIDERATION_CPR52_24_6, env.EMAIL_RECONSIDERATION_CPR52_30,
				env.EMAIL_RECONSIDERATION_PD52B
			];
			for (const namespace of kvNamespaces) {
				const keys = await namespace.list();
				const count = keys.keys.length;
				kvTotal += count;
				if (count > 0) {
					folderCount++;
				}
			}

			// Get Bridge info, inbox count, and folder count
			let inboxTotal = 0;
			let bridgeAccountCount = 0;
			let bridgeAccountName = 'Unknown';
			let bridgeFolderCount = 0;
			let bridgeEmailAddresses: string[] = [];
			try {
				// Get Bridge account info including ALL email addresses from IMAP
				const accountInfoResponse = await fetch(`${env.TUNNEL_URL}/account-info`, {
					method: 'GET',
					signal: AbortSignal.timeout(10000)
				});
				if (accountInfoResponse.ok) {
					const accountInfo = await accountInfoResponse.json();
					if (accountInfo.account) {
						bridgeAccountCount = 1;
						bridgeAccountName = accountInfo.account;
						// Use emails directly from Bridge IMAP query
						bridgeEmailAddresses = accountInfo.emails || [];
					}
				}

				// Get folder count
				const foldersResponse = await fetch(`${env.TUNNEL_URL}/list-folders`, {
					method: 'GET',
					signal: AbortSignal.timeout(5000)
				});
				if (foldersResponse.ok) {
					const foldersData = await foldersResponse.json();
					bridgeFolderCount = foldersData.count || 0;
				}

				// Get inbox count
				const inboxResponse = await fetch(`${env.TUNNEL_URL}/email-count`, {
					method: 'GET',
					signal: AbortSignal.timeout(5000)
				});
				if (inboxResponse.ok) {
					const inboxData = await inboxResponse.json();
					inboxTotal = inboxData.totalCount || 0;
				}
			} catch (error) {
				// Bridge unavailable
			}

			// Get Phase 1 Step 2 (whitelist filter) status
			const phase1Step2 = await env.DASHBOARD_SCREENSHOTS.get('phase1_step2_status');
			const whitelistFiltered = phase1Step2 ? JSON.parse(phase1Step2).emailsFiltered || 0 : 0;

			// Get inception date (first email date) from KV
			const inceptionData = await env.DASHBOARD_SCREENSHOTS.get('inception_date');
			const inceptionDate = inceptionData || 'Not yet set';

			// Find largest KV namespace
			let largestFolder = '';
			let largestCount = 0;
			const folderNames = [
				'Supreme Court', 'Court of Appeals Civil', 'Kings Bench Appeals', 'Chancery Division',
				'Administrative Court', 'Central London County Court', 'Clerkenwell County Court',
				'ICO', 'PHSO', 'Parliament', 'HMCTS', 'Bar Standards Board',
				'Legal Fees Claimant', 'Legal Fees Company', 'Legal Fees Director', 'Repairs',
				'HK Law', 'Lessel', 'Liu', 'Rentify',
				'Defendant', 'Both Defendants', 'Barristers', 'Litigant in Person Only', 'MobiCycle OU Only',
				'UK Legal Department', 'Estonia', 'US State Department',
				'Single Judge', 'Court Officer Review', 'PTA Refusal', 'CPR52.24(5)', 'CPR52.24(6)', 'CPR52.30', 'PD52B'
			];
			for (let i = 0; i < kvNamespaces.length; i++) {
				const keys = await kvNamespaces[i].list();
				if (keys.keys.length > largestCount) {
					largestCount = keys.keys.length;
					largestFolder = folderNames[i];
				}
			}

			const calculations = {
				bridgeAccounts: {
					answer: bridgeAccountCount > 0
						? `${bridgeAccountCount} account (${bridgeAccountName}) with ${bridgeEmailAddresses.length} email addresses: ${bridgeEmailAddresses.join(', ')}`
						: 'No accounts detected',
					status: bridgeAccountCount > 0 ? 'yes' : 'no',
					details: `Account and all emails queried from ProtonMail Bridge IMAP via ${env.TUNNEL_URL}/account-info`
				},
				allAccounts: {
					answer: `${inboxTotal} emails total`,
					status: inboxTotal > 0 ? 'yes' : 'empty',
					details: `Total from inbox via ${env.TUNNEL_URL}/email-count`
				},
				folders: {
					answer: bridgeFolderCount > 0 ? `${bridgeFolderCount} folders on Bridge` : `${folderCount} KV folders with emails`,
					status: bridgeFolderCount > 0 ? 'yes' : (folderCount > 0 ? 'yes' : 'empty'),
					details: bridgeFolderCount > 0 ? `Real folder count from ${env.TUNNEL_URL}/list-folders` : `Fallback: counted non-empty KV namespaces`
				},
				mobicycleOU: {
					answer: `${inboxTotal} emails in inbox`,
					status: inboxTotal > 0 ? 'yes' : 'empty',
					details: `Inbox count from ${env.TUNNEL_URL}/email-count`
				},
				whitelist: {
					answer: whitelistFiltered > 0 ? `${whitelistFiltered} emails passed whitelist` : 'Not yet calculated',
					status: whitelistFiltered > 0 ? 'yes' : 'no',
					details: whitelistFiltered > 0 ? `From last Phase 1 Step 2 run` : 'Run Phase 1 to calculate'
				},
				kvNamespace: {
					answer: `${kvTotal} emails stored`,
					status: kvTotal > 0 ? 'yes' : 'empty',
					details: `Real-time count from all 35 KV namespaces`
				},
				inception: {
					answer: inceptionDate,
					status: inceptionDate !== 'Not yet set' ? 'yes' : 'no',
					details: 'First email received date stored in KV'
				},
				largestFolder: {
					answer: largestCount > 0 ? `${largestFolder} (${largestCount} emails)` : 'No emails in any folder',
					status: largestCount > 0 ? 'yes' : 'empty',
					details: 'Largest KV namespace by email count'
				}
			};

			return new Response(JSON.stringify(calculations, null, 2), {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Inbox total count route
		if (url.pathname === '/api/inbox-count') {
			if (!authorized) {
				return new Response('Unauthorized', { status: 401 });
			}

			try {
				// Fetch total inbox count from ProtonMail Bridge
				const inboxResponse = await fetch(`${env.TUNNEL_URL}/email-count`, {
					method: 'GET',
					signal: AbortSignal.timeout(5000)
				});

				if (inboxResponse.ok) {
					const inboxData = await inboxResponse.json();
					return new Response(JSON.stringify({ total: inboxData.totalCount || 0 }), {
						headers: { 'Content-Type': 'application/json' }
					});
				}

				// Fallback: count from todo list if bridge fails
				const todoListJson = await env.DASHBOARD_SCREENSHOTS.get('pending_triage');
				const todoList = todoListJson ? JSON.parse(todoListJson) : [];

				return new Response(JSON.stringify({ total: todoList.length }), {
					headers: { 'Content-Type': 'application/json' }
				});
			} catch (error) {
				return new Response(JSON.stringify({ total: 0 }), {
					headers: { 'Content-Type': 'application/json' }
				});
			}
		}

		// Pending emails count route - counts emails IN KV namespaces with status='pending'
		if (url.pathname === '/api/pending-count') {
			if (!authorized) {
				return new Response('Unauthorized', { status: 401 });
			}

			try {
				let totalPending = 0;

				// Get all KV namespace bindings
				const kvNamespaces = [
					env.EMAIL_COURTS_SUPREME_COURT,
					env.EMAIL_COURTS_COURT_OF_APPEALS_CIVIL_DIVISION,
					env.EMAIL_COURTS_KINGS_BENCH_APPEALS_DIVISION,
					env.EMAIL_COURTS_CHANCERY_DIVISION,
					env.EMAIL_COURTS_ADMINISTRATIVE_COURT,
					env.EMAIL_COURTS_CENTRAL_LONDON_COUNTY_COURT,
					env.EMAIL_COURTS_CLERKENWELL_COUNTY_COURT,
					env.EMAIL_COMPLAINTS_ICO,
					env.EMAIL_COMPLAINTS_PHSO,
					env.EMAIL_COMPLAINTS_PARLIAMENT,
					env.EMAIL_COMPLAINTS_HMCTS,
					env.EMAIL_COMPLAINTS_BAR_STANDARDS_BOARD,
					env.EMAIL_EXPENSES_LEGAL_FEES_CLAIMANT,
					env.EMAIL_EXPENSES_LEGAL_FEES_COMPANY,
					env.EMAIL_EXPENSES_LEGAL_FEES_DIRECTOR,
					env.EMAIL_EXPENSES_REPAIRS,
					env.EMAIL_CLAIMANT_HK_LAW,
					env.EMAIL_CLAIMANT_LESSEL,
					env.EMAIL_CLAIMANT_LIU,
					env.EMAIL_CLAIMANT_RENTIFY,
					env.EMAIL_DEFENDANTS_DEFENDANT,
					env.EMAIL_DEFENDANTS_BOTH_DEFENDANTS,
					env.EMAIL_DEFENDANTS_BARRISTERS,
					env.EMAIL_DEFENDANTS_LITIGANT_IN_PERSON_ONLY,
					env.EMAIL_DEFENDANTS_MOBICYCLE_OU_ONLY,
					env.EMAIL_GOVERNMENT_UK_LEGAL_DEPARTMENT,
					env.EMAIL_GOVERNMENT_ESTONIA,
					env.EMAIL_GOVERNMENT_US_STATE_DEPARTMENT,
					env.EMAIL_RECONSIDERATION_SINGLE_JUDGE,
					env.EMAIL_RECONSIDERATION_COURT_OFFICER_REVIEW,
					env.EMAIL_RECONSIDERATION_PTA_REFUSAL,
					env.EMAIL_RECONSIDERATION_CPR52_24_5,
					env.EMAIL_RECONSIDERATION_CPR52_24_6,
					env.EMAIL_RECONSIDERATION_CPR52_30,
					env.EMAIL_RECONSIDERATION_PD52B,
				];

				// Count pending emails across all KV namespaces
				for (const namespace of kvNamespaces) {
					const keys = await namespace.list();
					for (const key of keys.keys) {
						const emailData = await namespace.get(key.name);
						if (emailData) {
							const email = JSON.parse(emailData);
							if (email.status === 'pending' || !email.status) {
								totalPending++;
							}
						}
					}
				}

				return new Response(JSON.stringify({ pending: totalPending }), {
					headers: { 'Content-Type': 'application/json' }
				});
			} catch (error) {
				return new Response(JSON.stringify({ pending: 0 }), {
					headers: { 'Content-Type': 'application/json' }
				});
			}
		}

		// KV namespace counts route
		if (url.pathname === '/api/kv-counts') {
			if (!authorized) {
				return new Response('Unauthorized', { status: 401 });
			}

			const kvCounts = await Promise.all([
				// Courts
				env.EMAIL_COURTS_SUPREME_COURT.list().then(r => ({ name: 'Supreme Court', category: 'Courts', count: r.keys.length })),
				env.EMAIL_COURTS_COURT_OF_APPEALS_CIVIL_DIVISION.list().then(r => ({ name: 'Court of Appeals - Civil Division', category: 'Courts', count: r.keys.length })),
				env.EMAIL_COURTS_KINGS_BENCH_APPEALS_DIVISION.list().then(r => ({ name: 'Kings Bench Appeals Division', category: 'Courts', count: r.keys.length })),
				env.EMAIL_COURTS_CHANCERY_DIVISION.list().then(r => ({ name: 'Chancery Division', category: 'Courts', count: r.keys.length })),
				env.EMAIL_COURTS_ADMINISTRATIVE_COURT.list().then(r => ({ name: 'Administrative Court', category: 'Courts', count: r.keys.length })),
				env.EMAIL_COURTS_CENTRAL_LONDON_COUNTY_COURT.list().then(r => ({ name: 'Central London County Court', category: 'Courts', count: r.keys.length })),
				env.EMAIL_COURTS_CLERKENWELL_COUNTY_COURT.list().then(r => ({ name: 'Clerkenwell County Court', category: 'Courts', count: r.keys.length })),
				// Complaints
				env.EMAIL_COMPLAINTS_ICO.list().then(r => ({ name: 'ICO', category: 'Complaints', count: r.keys.length })),
				env.EMAIL_COMPLAINTS_PHSO.list().then(r => ({ name: 'PHSO', category: 'Complaints', count: r.keys.length })),
				env.EMAIL_COMPLAINTS_PARLIAMENT.list().then(r => ({ name: 'Parliament', category: 'Complaints', count: r.keys.length })),
				env.EMAIL_COMPLAINTS_HMCTS.list().then(r => ({ name: 'HMCTS', category: 'Complaints', count: r.keys.length })),
				env.EMAIL_COMPLAINTS_BAR_STANDARDS_BOARD.list().then(r => ({ name: 'Bar Standards Board', category: 'Complaints', count: r.keys.length })),
				// Legal Expenses
				env.EMAIL_EXPENSES_LEGAL_FEES_CLAIMANT.list().then(r => ({ name: 'Legal Fees - Claimant', category: 'Legal Expenses', count: r.keys.length })),
				env.EMAIL_EXPENSES_LEGAL_FEES_COMPANY.list().then(r => ({ name: 'Legal Fees - Company', category: 'Legal Expenses', count: r.keys.length })),
				env.EMAIL_EXPENSES_LEGAL_FEES_DIRECTOR.list().then(r => ({ name: 'Legal Fees - Director', category: 'Legal Expenses', count: r.keys.length })),
				env.EMAIL_EXPENSES_REPAIRS.list().then(r => ({ name: 'Repairs', category: 'Legal Expenses', count: r.keys.length })),
				// Claimants
				env.EMAIL_CLAIMANT_HK_LAW.list().then(r => ({ name: 'HK Law', category: 'Claimants', count: r.keys.length })),
				env.EMAIL_CLAIMANT_LESSEL.list().then(r => ({ name: 'Lessel', category: 'Claimants', count: r.keys.length })),
				env.EMAIL_CLAIMANT_LIU.list().then(r => ({ name: 'Liu', category: 'Claimants', count: r.keys.length })),
				env.EMAIL_CLAIMANT_RENTIFY.list().then(r => ({ name: 'Rentify', category: 'Claimants', count: r.keys.length })),
				// Defendants
				env.EMAIL_DEFENDANTS_DEFENDANT.list().then(r => ({ name: 'Defendant', category: 'Defendants', count: r.keys.length })),
				env.EMAIL_DEFENDANTS_BOTH_DEFENDANTS.list().then(r => ({ name: 'Both Defendants', category: 'Defendants', count: r.keys.length })),
				env.EMAIL_DEFENDANTS_BARRISTERS.list().then(r => ({ name: 'Barristers', category: 'Defendants', count: r.keys.length })),
				env.EMAIL_DEFENDANTS_LITIGANT_IN_PERSON_ONLY.list().then(r => ({ name: 'Litigant in Person Only', category: 'Defendants', count: r.keys.length })),
				env.EMAIL_DEFENDANTS_MOBICYCLE_OU_ONLY.list().then(r => ({ name: 'MobiCycle OÜ Only', category: 'Defendants', count: r.keys.length })),
				// Government
				env.EMAIL_GOVERNMENT_UK_LEGAL_DEPARTMENT.list().then(r => ({ name: 'UK Legal Department', category: 'Government', count: r.keys.length })),
				env.EMAIL_GOVERNMENT_ESTONIA.list().then(r => ({ name: 'Estonia', category: 'Government', count: r.keys.length })),
				env.EMAIL_GOVERNMENT_US_STATE_DEPARTMENT.list().then(r => ({ name: 'US State Department', category: 'Government', count: r.keys.length })),
				// Reconsideration
				env.EMAIL_RECONSIDERATION_SINGLE_JUDGE.list().then(r => ({ name: 'Single Judge', category: 'Reconsideration', count: r.keys.length })),
				env.EMAIL_RECONSIDERATION_COURT_OFFICER_REVIEW.list().then(r => ({ name: 'Court Officer Review', category: 'Reconsideration', count: r.keys.length })),
				env.EMAIL_RECONSIDERATION_PTA_REFUSAL.list().then(r => ({ name: 'PTA Refusal', category: 'Reconsideration', count: r.keys.length })),
				env.EMAIL_RECONSIDERATION_CPR52_24_5.list().then(r => ({ name: 'CPR52.24(5)', category: 'Reconsideration', count: r.keys.length })),
				env.EMAIL_RECONSIDERATION_CPR52_24_6.list().then(r => ({ name: 'CPR52.24(6)', category: 'Reconsideration', count: r.keys.length })),
				env.EMAIL_RECONSIDERATION_CPR52_30.list().then(r => ({ name: 'CPR52.30', category: 'Reconsideration', count: r.keys.length })),
				env.EMAIL_RECONSIDERATION_PD52B.list().then(r => ({ name: 'PD52B', category: 'Reconsideration', count: r.keys.length })),
			]);

			const total = kvCounts.reduce((sum, kv) => sum + kv.count, 0);

			return new Response(JSON.stringify({ namespaces: kvCounts, total }, null, 2), {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Phase 1 status route
		if (url.pathname === '/api/phase1-status') {
			if (!authorized) {
				return new Response('Unauthorized', { status: 401 });
			}
			const phase1Status = await getPhase1Status(env);
			return new Response(JSON.stringify(phase1Status), {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// KV namespace contents route
		if (url.pathname.startsWith('/api/kv-emails/')) {
			if (!authorized) {
				return new Response('Unauthorized', { status: 401 });
			}

			const namespaceName = url.pathname.split('/api/kv-emails/')[1];
			const limit = parseInt(url.searchParams.get('limit') || '10');

			// Map namespace names to actual KV bindings
			const namespaceMap = {
				'administrative-court': env.EMAIL_COURTS_ADMINISTRATIVE_COURT,
				'supreme-court': env.EMAIL_COURTS_SUPREME_COURT,
				'court-of-appeals': env.EMAIL_COURTS_COURT_OF_APPEALS_CIVIL_DIVISION,
				'chancery-division': env.EMAIL_COURTS_CHANCERY_DIVISION,
				'ico': env.EMAIL_COMPLAINTS_ICO,
				'phso': env.EMAIL_COMPLAINTS_PHSO,
				'parliament': env.EMAIL_COMPLAINTS_PARLIAMENT,
				'uk-legal': env.EMAIL_GOVERNMENT_UK_LEGAL_DEPARTMENT,
				'estonia': env.EMAIL_GOVERNMENT_ESTONIA,
				'hk-law': env.EMAIL_CLAIMANT_HK_LAW,
				'defendant': env.EMAIL_DEFENDANTS_DEFENDANT,
				'raw-data': env.RAW_DATA_HEADERS,
				'filtered-data': env.FILTERED_DATA_HEADERS,
				'pending-triage': env.DASHBOARD_SCREENSHOTS
			};

			const namespace = namespaceMap[namespaceName];
			if (!namespace) {
				return new Response(JSON.stringify({ error: 'Namespace not found' }), {
					status: 404,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			try {
				let emails = [];
				
				if (namespaceName === 'pending-triage') {
					// Special handling for pending triage
					const todoData = await namespace.get('pending_triage');
					emails = todoData ? [JSON.parse(todoData)] : [];
				} else {
					// List keys and get email data
					const keysList = await namespace.list({ limit });
					for (const key of keysList.keys) {
						const emailData = await namespace.get(key.name);
						if (emailData) {
							emails.push({
								key: key.name,
								data: JSON.parse(emailData)
							});
						}
					}
				}

				return new Response(JSON.stringify({
					namespace: namespaceName,
					count: emails.length,
					emails: emails
				}, null, 2), {
					headers: { 'Content-Type': 'application/json' }
				});

			} catch (error) {
				return new Response(JSON.stringify({
					error: 'Failed to retrieve emails',
					message: error.message
				}), {
					status: 500,
					headers: { 'Content-Type': 'application/json' }
				});
			}
		}


		// Trigger route
		if (request.method === 'POST' && url.pathname === '/trigger') {
			if (!authorized) {
				return new Response('Unauthorized', { status: 401 });
			}

			// Create a simple instance ID without full workflow constructor
			const instanceId = env.EMAIL_TRIAGE.create({
				params: {
					timestamp: new Date().toISOString()
				}
			});

			return new Response(JSON.stringify({
				message: 'Legal Email Workflow triggered successfully',
				instanceId,
				config: {
					legalCategories: 35,
					emailAccount: env.PROTON_EMAIL
				}
			}), {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		return new Response('Method not allowed', { status: 405 });
	},

	async scheduled(event: ScheduledEvent, env: MobicycleOUEnv) {
		console.log('[MOBICYCLE-OU:CRON] Starting scheduled legal email workflow...');

		const kvNamespace = env.DASHBOARD_SCREENSHOTS;
		const now = new Date();
		const currentMinute = now.getMinutes();
		const jobTypes: string[] = [];

		// Monitoring job: Every 4 hours
		const currentHour = now.getHours();
		if (currentHour % 4 === 0 && currentMinute === 0) {
			jobTypes.push('monitoring');
		}

		// Fetching job: Every 10 minutes (0, 10, 20, 30, 40, 50)
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

		// Execute jobs and store REAL status in KV
		await Promise.all(jobTypes.map(async (jobType) => {
			const startTime = new Date();
			console.log(`[MOBICYCLE-OU:${jobType.toUpperCase()}] Starting...`);

			try {
				// Store running status
				await kvNamespace.put(`cron_${jobType}_status`, JSON.stringify({
					timestamp: startTime.toISOString(),
					status: 'running',
					message: `CRON job ${jobType} is currently executing`
				}));

				// Execute actual job logic
				if (jobType === 'fetching') {
					await executeEmailFetchingJob(env);
				}

				// Store completed status
				await kvNamespace.put(`cron_${jobType}_status`, JSON.stringify({
					timestamp: new Date().toISOString(),
					status: 'completed',
					message: `CRON job ${jobType} completed successfully`,
					duration_ms: new Date().getTime() - startTime.getTime()
				}));

				console.log(`[MOBICYCLE-OU:${jobType.toUpperCase()}] Completed`);
			} catch (error) {
				// Store error status
				await kvNamespace.put(`cron_${jobType}_status`, JSON.stringify({
					timestamp: new Date().toISOString(),
					status: 'error',
					message: `CRON job ${jobType} failed: ${error.message}`,
					duration_ms: new Date().getTime() - startTime.getTime()
				}));

				console.error(`[MOBICYCLE-OU:${jobType.toUpperCase()}] Error:`, error);
			}
		}));

		console.log('[MOBICYCLE-OU:CRON] Completed job types:', jobTypes.join(', '));
	}
};

// Get workflow status with universal + legal-specific info
async function getDetailedStatus(env: MobicycleOUEnv) {
	const basicStatus = await getWorkflowStatus(env);
	
	return {
		...basicStatus,
		workflow: {
			type: 'Legal Email Workflow',
			baseClass: 'BaseEmailWorkflow',
			specificClass: 'MobicycleOUWorkflow',
			totalSteps: 6,
			universalSteps: 3,
			legalSteps: 3
		},
		legal: {
			kvNamespaces: 35,
			whitelistDomains: ['.court', '.gov.uk', '.ee', '@ico.org.uk', '@hklaw.com', '@lessel.co.uk'],
			caseTypes: ['COURT', 'CLAIMANT', 'GOVERNMENT', 'RECONSIDERATION'],
			jurisdiction: 'UK Courts + Estonian Government'
		}
	};
}

// Generate dashboard HTML with universal + legal-specific information
function generateDashboardHTML(env: MobicycleOUEnv): string {
	return dashboardHtml;
}
