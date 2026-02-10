/**
 * Universal Whitelist Engine
 * Reusable whitelist logic that works with any classification rules
 */

import type {
	Email,
	WhitelistEntry,
	EmailWhitelist,
	ClassificationRule,
	WhitelistCheckResult
} from './types';

/**
 * Generate tags based on KV namespace and pattern
 * Universal logic - works for any domain
 */
export function generateTags(namespace: string, pattern: string) {
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

/**
 * Generate whitelist from classification rules
 * Universal function - accepts rules from any project
 */
export function generateEmailWhitelist(
	classificationRules: ClassificationRule[],
	manualWhitelist: WhitelistEntry[] = []
): EmailWhitelist {
	const whitelistEntries: WhitelistEntry[] = [];
	const domains = new Set<string>();
	const patterns = new Set<string>();

	// Process each classification rule
	for (const rule of classificationRules) {
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

	// Merge with manual whitelist
	const allEntries = [...whitelistEntries, ...manualWhitelist];

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

/**
 * Check if an email is whitelisted
 * Universal function - works with any whitelist
 */
export function isEmailWhitelisted(
	email: string,
	whitelist: EmailWhitelist
): WhitelistCheckResult {
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

/**
 * Get KV namespace for a given email address
 * Universal function - works with any whitelist
 */
export function getKVNamespaceForEmail(
	email: string,
	whitelist: EmailWhitelist
): string {
	const result = isEmailWhitelisted(email, whitelist);

	if (result.allowed && result.tags && result.tags.kvNamespace.length > 0) {
		// Return the first (primary) KV namespace for this email
		const kvNamespace = result.tags.kvNamespace[0];
		// Convert namespace name to binding format
		return kvNamespace.replace(/-/g, '_').toUpperCase();
	}

	// No matching namespace — email is not whitelisted or has no category
	return 'UNCLASSIFIED';
}
