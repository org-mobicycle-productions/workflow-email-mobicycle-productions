/**
 * Universal Email Processing Types
 * Shared across all MobiCycle accounts (mobicycle, mobicycle-ou, mobicycle-productions)
 */

export interface Email {
	id: string;
	from: string;
	to: string;
	subject: string;
	body: string;
	date: string;
	messageId: string;
}

export interface WhitelistEntry {
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

export interface EmailWhitelist {
	addresses: WhitelistEntry[];
	domains: string[];
	patterns: string[];
	lastUpdated: string;
}

export interface ClassificationRule {
	namespace: string;
	conditions: {
		toIncludes?: string[];
		fromIncludes?: string[];
		subjectIncludes?: string[];
	};
}

export interface WhitelistCheckResult {
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
}
