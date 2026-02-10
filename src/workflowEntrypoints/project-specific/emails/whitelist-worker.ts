/**
 * Email Whitelist Worker for MobiCycle Legal Email Triage
 * Extracts email addresses and domains from classification rules
 * Creates whitelist based on KV namespace categories
 */

interface WhitelistEntry {
	address: string;
	domain?: string;
	pattern: string;
	categories: string[];
	type: 'exact' | 'domain' | 'pattern';
	tags: {
		legalType: string[];
		jurisdiction: string[];
		institution: string[];
		priority: 'high' | 'medium' | 'low';
		kvNamespace: string[];
	};
}

interface EmailWhitelist {
	addresses: WhitelistEntry[];
	domains: string[];
	patterns: string[];
	lastUpdated: string;
}

// Extract from populate-kv.ts classification rules
const CLASSIFICATION_RULES = [
	// PHSO Complaints
	{
		namespace: "email-complaints-phso",
		conditions: {
			toIncludes: ["ombudsman.org.uk", "informationrights@ombudsman", "complaintsaboutservice@ombudsman"],
			subjectIncludes: ["phso", "ombudsman"]
		}
	},
	
	// HMCTS Complaints
	{
		namespace: "email-complaints-hmcts",
		conditions: {
			toIncludes: ["hmcts.gov.uk", "justice.gov.uk"],
			subjectIncludes: ["hmcts", "court", "tribunal"]
		}
	},
	
	// Parliament Complaints
	{
		namespace: "email-complaints-parliament",
		conditions: {
			toIncludes: ["parliament.uk", "mp@", "mep@"],
			subjectIncludes: ["parliament", "parliamentary", "mp", "member of parliament"]
		}
	},
	
	// Bar Standards Board Complaints
	{
		namespace: "email-complaints-bar-standards-board",
		conditions: {
			toIncludes: ["barstandardsboard.org.uk", "barcouncil.org.uk"],
			subjectIncludes: ["bar standards", "barrister", "chambers"]
		}
	},
	
	// ICO Complaints  
	{
		namespace: "email-complaints-ico",
		conditions: {
			toIncludes: ["ico.org.uk", "casework@ico.org.uk", "foi@ico.org.uk"],
			fromIncludes: ["ico.org.uk", "informationcommissioner"],
			subjectIncludes: ["ico", "information commissioner", "data protection", "freedom of information", "foi", "gdpr", "data breach"]
		}
	},
	
	// Courts - Administrative Court
	{
		namespace: "email-courts-administrative-court",
		conditions: {
			toIncludes: ["administrativecourt", "admin.court"],
			subjectIncludes: ["administrative court", "judicial review"]
		}
	},
	
	// Courts - Central London County Court
	{
		namespace: "email-courts-central-london-county-court",
		conditions: {
			toIncludes: ["centrallondon", "central.london"],
			subjectIncludes: ["central london county court", "clcc"]
		}
	},
	
	// Courts - Chancery Division
	{
		namespace: "email-courts-chancery-division",
		conditions: {
			toIncludes: ["chancery"],
			subjectIncludes: ["chancery division", "chancery court"]
		}
	},
	
	// Courts - Supreme Court
	{
		namespace: "email-courts-supreme-court",
		conditions: {
			toIncludes: ["supremecourt.uk"],
			subjectIncludes: ["supreme court", "uksc"]
		}
	},
	
	// Government - UK Legal Department
	{
		namespace: "email-government-uk-legal-department",
		conditions: {
			toIncludes: ["gov.uk", "government-legal"],
			subjectIncludes: ["government legal", "treasury solicitor"]
		}
	},
	
	// Government - US State Department
	{
		namespace: "email-government-us-state-department",
		conditions: {
			toIncludes: ["state.gov"],
			subjectIncludes: ["state department", "embassy", "consulate"]
		}
	},
	
	// Government - Estonia
	{
		namespace: "email-government-estonia",
		conditions: {
			toIncludes: [".ee", "gov.ee"],
			subjectIncludes: ["estonia", "estonian government"]
		}
	},
	
	// Claimants
	{
		namespace: "email-claimant-hk-law",
		conditions: {
			fromIncludes: ["hk-law", "hongkong"],
			toIncludes: ["hk-law", "hongkong"],
			subjectIncludes: ["hk law", "hong kong"]
		}
	},
	
	{
		namespace: "email-claimant-lessel",
		conditions: {
			fromIncludes: ["lessel"],
			toIncludes: ["lessel"],
			subjectIncludes: ["lessel"]
		}
	},
	
	{
		namespace: "email-claimant-liu",
		conditions: {
			fromIncludes: ["liu"],
			toIncludes: ["liu"],
			subjectIncludes: ["liu"]
		}
	},
	
	{
		namespace: "email-claimant-rentify",
		conditions: {
			fromIncludes: ["rentify"],
			toIncludes: ["rentify"],
			subjectIncludes: ["rentify"]
		}
	}
];

// Generate tags based on KV namespace
function generateTags(namespace: string, pattern: string) {
	const tags = {
		legalType: [] as string[],
		jurisdiction: [] as string[],
		institution: [] as string[],
		priority: 'medium' as 'high' | 'medium' | 'low',
		kvNamespace: [namespace]
	};

	// Determine legal type from namespace
	if (namespace.includes('complaints')) {
		tags.legalType.push('complaints', 'regulatory');
		tags.priority = 'high';
	}
	if (namespace.includes('courts')) {
		tags.legalType.push('litigation', 'judicial');
		tags.priority = 'high';
	}
	if (namespace.includes('government')) {
		tags.legalType.push('administrative', 'regulatory');
		tags.priority = 'high';
	}
	if (namespace.includes('claimant')) {
		tags.legalType.push('private-party', 'litigation');
		tags.priority = 'medium';
	}
	if (namespace.includes('defendants')) {
		tags.legalType.push('defense', 'litigation');
		tags.priority = 'medium';
	}
	if (namespace.includes('expenses')) {
		tags.legalType.push('financial', 'administrative');
		tags.priority = 'low';
	}
	if (namespace.includes('reconsideration')) {
		tags.legalType.push('appeals', 'judicial');
		tags.priority = 'high';
	}

	// Determine jurisdiction from pattern
	if (pattern.includes('.uk') || pattern.includes('gov.uk')) {
		tags.jurisdiction.push('UK');
	}
	if (pattern.includes('.gov') || pattern.includes('state.gov')) {
		tags.jurisdiction.push('US');
	}
	if (pattern.includes('.ee') || pattern.includes('gov.ee')) {
		tags.jurisdiction.push('Estonia');
	}
	if (pattern.includes('ombudsman')) {
		tags.jurisdiction.push('UK');
		tags.institution.push('ombudsman');
	}

	// Determine institution type
	if (pattern.includes('court') || pattern.includes('judiciary')) {
		tags.institution.push('court', 'judicial');
	}
	if (pattern.includes('government') || pattern.includes('gov.')) {
		tags.institution.push('government', 'executive');
	}
	if (pattern.includes('parliament')) {
		tags.institution.push('parliament', 'legislative');
	}
	if (pattern.includes('ombudsman')) {
		tags.institution.push('ombudsman', 'regulatory');
	}
	if (pattern.includes('bar') || pattern.includes('law')) {
		tags.institution.push('legal-profession', 'regulatory');
	}

	return tags;
}

// Generate whitelist from classification rules
function generateEmailWhitelist(): EmailWhitelist {
	const whitelistEntries: WhitelistEntry[] = [];
	const domains = new Set<string>();
	const patterns = new Set<string>();

	// Process each classification rule
	for (const rule of CLASSIFICATION_RULES) {
		const categories = [rule.namespace];
		
		// Process 'toIncludes' patterns
		if (rule.conditions.toIncludes) {
			for (const pattern of rule.conditions.toIncludes) {
				const tags = generateTags(rule.namespace, pattern);
				
				if (pattern.includes('@')) {
					// Exact email address
					whitelistEntries.push({
						address: pattern,
						pattern,
						categories,
						type: 'exact',
						tags
					});
				} else if (pattern.startsWith('.') || pattern.includes('.')) {
					// Domain pattern
					const domain = pattern.startsWith('.') ? pattern.substring(1) : pattern;
					domains.add(domain);
					whitelistEntries.push({
						address: `*@${domain}`,
						domain,
						pattern,
						categories,
						type: 'domain',
						tags
					});
				} else {
					// Pattern match
					patterns.add(pattern);
					whitelistEntries.push({
						address: pattern,
						pattern,
						categories,
						type: 'pattern',
						tags
					});
				}
			}
		}
		
		// Process 'fromIncludes' patterns
		if (rule.conditions.fromIncludes) {
			for (const pattern of rule.conditions.fromIncludes) {
				const tags = generateTags(rule.namespace, pattern);
				
				if (pattern.includes('@')) {
					// Exact email address
					whitelistEntries.push({
						address: pattern,
						pattern,
						categories,
						type: 'exact',
						tags
					});
				} else {
					// Pattern match
					patterns.add(pattern);
					whitelistEntries.push({
						address: pattern,
						pattern,
						categories,
						type: 'pattern',
						tags
					});
				}
			}
		}
	}

	return {
		addresses: whitelistEntries,
		domains: Array.from(domains).sort(),
		patterns: Array.from(patterns).sort(),
		lastUpdated: new Date().toISOString()
	};
}

// Manual whitelist for legal domains and addresses
function getManualWhitelist(): WhitelistEntry[] {
	return [
		// UK Courts
		{ 
			address: "*@courts.gov.uk", 
			pattern: "courts.gov.uk", 
			categories: ["courts"], 
			type: 'domain',
			tags: {
				legalType: ['litigation', 'judicial'],
				jurisdiction: ['UK'],
				institution: ['court', 'judicial'],
				priority: 'high',
				kvNamespace: ['email-courts-administrative-court', 'email-courts-central-london-county-court']
			}
		},
		{ 
			address: "*@justice.gov.uk", 
			pattern: "justice.gov.uk", 
			categories: ["courts", "government"], 
			type: 'domain',
			tags: {
				legalType: ['litigation', 'judicial', 'administrative'],
				jurisdiction: ['UK'],
				institution: ['court', 'government'],
				priority: 'high',
				kvNamespace: ['email-courts-administrative-court', 'email-government-uk-legal-department']
			}
		},
		{ 
			address: "*@judiciary.uk", 
			pattern: "judiciary.uk", 
			categories: ["courts"], 
			type: 'domain',
			tags: {
				legalType: ['litigation', 'judicial'],
				jurisdiction: ['UK'],
				institution: ['court', 'judicial'],
				priority: 'high',
				kvNamespace: ['email-courts-supreme-court']
			}
		},
		
		// Legal Institutions
		{ 
			address: "*@lawsociety.org.uk", 
			pattern: "lawsociety.org.uk", 
			categories: ["legal"], 
			type: 'domain',
			tags: {
				legalType: ['regulatory', 'professional'],
				jurisdiction: ['UK'],
				institution: ['legal-profession', 'regulatory'],
				priority: 'medium',
				kvNamespace: ['email-complaints-bar-standards-board']
			}
		},
		{ 
			address: "*@sra.org.uk", 
			pattern: "sra.org.uk", 
			categories: ["legal"], 
			type: 'domain',
			tags: {
				legalType: ['regulatory', 'professional'],
				jurisdiction: ['UK'],
				institution: ['legal-profession', 'regulatory'],
				priority: 'medium',
				kvNamespace: ['email-complaints-bar-standards-board']
			}
		},
		{ 
			address: "*@barcouncil.org.uk", 
			pattern: "barcouncil.org.uk", 
			categories: ["legal"], 
			type: 'domain',
			tags: {
				legalType: ['regulatory', 'professional'],
				jurisdiction: ['UK'],
				institution: ['legal-profession', 'regulatory'],
				priority: 'medium',
				kvNamespace: ['email-complaints-bar-standards-board']
			}
		},
		{ 
			address: "*@barstandardsboard.org.uk", 
			pattern: "barstandardsboard.org.uk", 
			categories: ["legal"], 
			type: 'domain',
			tags: {
				legalType: ['regulatory', 'professional'],
				jurisdiction: ['UK'],
				institution: ['legal-profession', 'regulatory'],
				priority: 'high',
				kvNamespace: ['email-complaints-bar-standards-board']
			}
		},
		
		// Government Departments
		{ 
			address: "*@cabinet-office.gov.uk", 
			pattern: "cabinet-office.gov.uk", 
			categories: ["government"], 
			type: 'domain',
			tags: {
				legalType: ['administrative', 'regulatory'],
				jurisdiction: ['UK'],
				institution: ['government', 'executive'],
				priority: 'high',
				kvNamespace: ['email-government-uk-legal-department']
			}
		},
		{ 
			address: "*@homeoffice.gov.uk", 
			pattern: "homeoffice.gov.uk", 
			categories: ["government"], 
			type: 'domain',
			tags: {
				legalType: ['administrative', 'regulatory'],
				jurisdiction: ['UK'],
				institution: ['government', 'executive'],
				priority: 'high',
				kvNamespace: ['email-government-uk-legal-department']
			}
		},
		{ 
			address: "*@fco.gov.uk", 
			pattern: "fco.gov.uk", 
			categories: ["government"], 
			type: 'domain',
			tags: {
				legalType: ['administrative', 'international'],
				jurisdiction: ['UK'],
				institution: ['government', 'executive'],
				priority: 'high',
				kvNamespace: ['email-government-uk-legal-department']
			}
		},
		
		// Ombudsman Services
		{ 
			address: "*@ombudsman.org.uk", 
			pattern: "ombudsman.org.uk", 
			categories: ["complaints"], 
			type: 'domain',
			tags: {
				legalType: ['complaints', 'regulatory'],
				jurisdiction: ['UK'],
				institution: ['ombudsman', 'regulatory'],
				priority: 'high',
				kvNamespace: ['email-complaints-phso']
			}
		},
		{ 
			address: "*@ico.org.uk", 
			pattern: "ico.org.uk", 
			categories: ["complaints"], 
			type: 'domain',
			tags: {
				legalType: ['complaints', 'regulatory', 'data-protection'],
				jurisdiction: ['UK'],
				institution: ['ombudsman', 'regulatory'],
				priority: 'high',
				kvNamespace: ['email-complaints-ico']
			}
		},
		{ 
			address: "*@lgo.org.uk", 
			pattern: "lgo.org.uk", 
			categories: ["complaints"], 
			type: 'domain',
			tags: {
				legalType: ['complaints', 'regulatory'],
				jurisdiction: ['UK'],
				institution: ['ombudsman', 'regulatory'],
				priority: 'high',
				kvNamespace: ['email-complaints-phso']
			}
		},
		{ 
			address: "*@phso.org.uk", 
			pattern: "phso.org.uk", 
			categories: ["complaints"], 
			type: 'domain',
			tags: {
				legalType: ['complaints', 'regulatory'],
				jurisdiction: ['UK'],
				institution: ['ombudsman', 'regulatory'],
				priority: 'high',
				kvNamespace: ['email-complaints-phso']
			}
		},
		
		// International
		{ 
			address: "*@state.gov", 
			pattern: "state.gov", 
			categories: ["government"], 
			type: 'domain',
			tags: {
				legalType: ['administrative', 'international'],
				jurisdiction: ['US'],
				institution: ['government', 'executive'],
				priority: 'high',
				kvNamespace: ['email-government-us-state-department']
			}
		},
		{ 
			address: "*@gov.ee", 
			pattern: "gov.ee", 
			categories: ["government"], 
			type: 'domain',
			tags: {
				legalType: ['administrative', 'regulatory'],
				jurisdiction: ['Estonia'],
				institution: ['government', 'executive'],
				priority: 'high',
				kvNamespace: ['email-government-estonia']
			}
		},
		{ 
			address: "*@riigikantselei.ee", 
			pattern: "riigikantselei.ee", 
			categories: ["government"], 
			type: 'domain',
			tags: {
				legalType: ['administrative', 'regulatory'],
				jurisdiction: ['Estonia'],
				institution: ['government', 'executive'],
				priority: 'high',
				kvNamespace: ['email-government-estonia']
			}
		},
		
		// Legal Case Management
		{ 
			address: "*@courtservice.gov.uk", 
			pattern: "courtservice.gov.uk", 
			categories: ["courts"], 
			type: 'domain',
			tags: {
				legalType: ['litigation', 'administrative'],
				jurisdiction: ['UK'],
				institution: ['court', 'judicial'],
				priority: 'high',
				kvNamespace: ['email-courts-administrative-court']
			}
		},
		{ 
			address: "*@tribunal.gov.uk", 
			pattern: "tribunal.gov.uk", 
			categories: ["courts"], 
			type: 'domain',
			tags: {
				legalType: ['litigation', 'administrative'],
				jurisdiction: ['UK'],
				institution: ['court', 'judicial'],
				priority: 'high',
				kvNamespace: ['email-complaints-hmcts']
			}
		}
	];
}

// Combine automated and manual whitelists
function getCompleteWhitelist(): EmailWhitelist {
	const automated = generateEmailWhitelist();
	const manual = getManualWhitelist();
	
	// Merge entries
	const allEntries = [...automated.addresses, ...manual];
	
	// Remove duplicates based on pattern
	const uniqueEntries = allEntries.reduce((acc, entry) => {
		const existing = acc.find(e => e.pattern === entry.pattern);
		if (existing) {
			// Merge categories and tags
			existing.categories = [...new Set([...existing.categories, ...entry.categories])];
			existing.tags.legalType = [...new Set([...existing.tags.legalType, ...entry.tags.legalType])];
			existing.tags.jurisdiction = [...new Set([...existing.tags.jurisdiction, ...entry.tags.jurisdiction])];
			existing.tags.institution = [...new Set([...existing.tags.institution, ...entry.tags.institution])];
			existing.tags.kvNamespace = [...new Set([...existing.tags.kvNamespace, ...entry.tags.kvNamespace])];
			// Keep highest priority
			if (entry.tags.priority === 'high' || (entry.tags.priority === 'medium' && existing.tags.priority === 'low')) {
				existing.tags.priority = entry.tags.priority;
			}
		} else {
			acc.push(entry);
		}
		return acc;
	}, [] as WhitelistEntry[]);
	
	// Extract unique domains and patterns
	const allDomains = new Set<string>();
	const allPatterns = new Set<string>();
	
	for (const entry of uniqueEntries) {
		if (entry.domain) allDomains.add(entry.domain);
		allPatterns.add(entry.pattern);
	}
	
	return {
		addresses: uniqueEntries.sort((a, b) => a.pattern.localeCompare(b.pattern)),
		domains: Array.from(allDomains).sort(),
		patterns: Array.from(allPatterns).sort(),
		lastUpdated: new Date().toISOString()
	};
}

// This function is now defined below as isEmailWhitelistedDetailed

// Export whitelist as JSON
function exportWhitelist(): string {
	const whitelist = getCompleteWhitelist();
	return JSON.stringify(whitelist, null, 2);
}

// Main function to generate and display whitelist
function main() {
	console.log("🔍 Generating email whitelist from KV namespace classifications...\n");
	
	const whitelist = getCompleteWhitelist();
	
	console.log(`📊 Whitelist Statistics:`);
	console.log(`   Total entries: ${whitelist.addresses.length}`);
	console.log(`   Unique domains: ${whitelist.domains.length}`);
	console.log(`   Unique patterns: ${whitelist.patterns.length}`);
	console.log(`   Last updated: ${whitelist.lastUpdated}\n`);
	
	console.log("📧 Email Address Patterns with Tags:");
	for (const entry of whitelist.addresses) {
		console.log(`   ${entry.type.toUpperCase().padEnd(7)} | ${entry.address.padEnd(40)} | ${entry.tags.priority.toUpperCase().padEnd(6)} | ${entry.tags.kvNamespace.join(', ')}`);
		console.log(`     Legal: ${entry.tags.legalType.join(', ')} | Jurisdiction: ${entry.tags.jurisdiction.join(', ')} | Institution: ${entry.tags.institution.join(', ')}`);
	}
	
	console.log("\n🌐 Whitelisted Domains:");
	for (const domain of whitelist.domains) {
		console.log(`   ${domain}`);
	}
	
	console.log("\n🔍 Pattern Matches:");
	for (const pattern of whitelist.patterns) {
		console.log(`   ${pattern}`);
	}
	
	// Test some email addresses
	console.log("\n🧪 Testing sample email addresses:");
	const testEmails = [
		"clerk@courts.gov.uk",
		"info@ombudsman.org.uk", 
		"admin@supremecourt.uk",
		"legal@gov.ee",
		"contact@state.gov",
		"casework@ico.org.uk",
		"foi@ico.org.uk",
		"spam@example.com"
	];
	
	for (const email of testEmails) {
		const result = isEmailWhitelistedDetailed(email, whitelist);
		console.log(`   ${email.padEnd(30)} | ${result.allowed ? '✅ ALLOWED' : '❌ BLOCKED'} | ${result.categories.join(', ')}`);
		if (result.allowed && result.tags) {
			console.log(`     -> KV: ${result.tags.kvNamespace.join(', ')} | Legal: ${result.tags.legalType.join(', ')} | Priority: ${result.tags.priority}`);
		}
	}
}

// Get KV namespace for a given email address
function getKVNamespaceForEmail(email: string): string {
	const whitelist = getCompleteWhitelist();
	const result = isEmailWhitelistedDetailed(email, whitelist);
	
	if (result.allowed && result.tags && result.tags.kvNamespace.length > 0) {
		// Return the first (primary) KV namespace for this email
		const kvNamespace = result.tags.kvNamespace[0];
		// Convert namespace name to binding format
		return kvNamespace.replace(/-/g, '_').toUpperCase();
	}
	
	// No matching namespace — email is not whitelisted or has no category
	return 'UNCLASSIFIED';
}

// Simpler function just for checking whitelist status (used in workflow)
function isEmailWhitelistedSimple(email: string): boolean {
	const whitelist = getCompleteWhitelist();
	const result = isEmailWhitelistedDetailed(email, whitelist);
	return result.allowed;
}

// Rename the detailed function to avoid conflict
function isEmailWhitelistedDetailed(email: string, whitelist: EmailWhitelist): { 
	allowed: boolean; 
	categories: string[];
	tags?: {
		legalType: string[];
		jurisdiction: string[];
		institution: string[];
		priority: 'high' | 'medium' | 'low';
		kvNamespace: string[];
	};
	matchedPattern?: string;
} {
	const emailLower = email.toLowerCase();
	
	for (const entry of whitelist.addresses) {
		let matches = false;
		
		switch (entry.type) {
			case 'exact':
				matches = emailLower === entry.pattern.toLowerCase();
				break;
			case 'domain':
				if (entry.domain) {
					matches = emailLower.endsWith(`@${entry.domain.toLowerCase()}`);
				}
				break;
			case 'pattern':
				matches = emailLower.includes(entry.pattern.toLowerCase());
				break;
		}
		
		if (matches) {
			return { 
				allowed: true, 
				categories: entry.categories,
				tags: entry.tags,
				matchedPattern: entry.pattern
			};
		}
	}
	
	return { allowed: false, categories: [] };
}

// Export functions for use in Cloudflare Worker
export {
	generateEmailWhitelist,
	getManualWhitelist,
	getCompleteWhitelist,
	isEmailWhitelistedDetailed,
	isEmailWhitelistedSimple as isEmailWhitelisted,
	getKVNamespaceForEmail,
	exportWhitelist,
	EmailWhitelist,
	WhitelistEntry
};

// Run if executed directly (Node.js only)
// if (require.main === module) {
//     main();
// }