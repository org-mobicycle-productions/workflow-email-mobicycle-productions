/**
 * Email Triage Workflow - MobiCycle Productions Account
 * ----------------------------------------------------
 * Supplier and business email management for suppliers@mobicycle.productions
 * 
 * CRITICAL: This is ONLY for the MobiCycle Productions account
 * Different business logic from legal account - NO legal privilege
 */

import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';

export interface EmailTriageParams {
	batchId: string;
	timestamp: string;
}

export interface Email {
	id: string;
	from: string;
	to: string;
	subject: string;
	body: string;
	date: string;
	messageId: string;
}

export interface BusinessContext {
	keywords: string[];
	addresses: string[];
	supplierIds: string[];
	orderNumbers: string[];
	relatedEmails: Email[];
	priority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface BusinessClassification {
	level: 'no-action' | 'low-complexity' | 'high-complexity';
	category: 'supplier' | 'customer' | 'internal' | 'compliance' | 'financial';
	reasoning: string;
	confidence: number;
}

export class EmailTriageWorkflow extends WorkflowEntrypoint {
	async run(event: WorkflowEvent<EmailTriageParams>, step: WorkflowStep) {
		const { batchId, timestamp } = event.payload;
		
		console.log(`[PRODUCTIONS] Starting business email triage: ${batchId}`);
		
		try {
			// Phase 1: Fetch emails from ProtonMail Bridge via tunnel
			const allEmails = await step.do('fetch-emails', async () => {
				const response = await fetch('https://mail.mobicycle.productions/fetch-emails', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ account: 'suppliers@mobicycle.productions' })
				});
				return await response.json() as Email[];
			});
			
			// Phase 2: Filter out emails where suppliers@mobicycle.productions is sender
			const filteredEmails = await step.do('filter-emails', async () => {
				return allEmails.filter(email => 
					!email.from.toLowerCase().includes('suppliers@mobicycle.productions')
				);
			});
			
			if (filteredEmails.length === 0) {
				console.log('[PRODUCTIONS] No relevant business emails to process');
				return { status: 'no-emails', account: 'productions' };
			}
			
			// Phase 3: Update business todo list
			await step.do('update-business-todo', async () => {
				await this.env.BUSINESS_CASES.put(
					`todo-${batchId}`, 
					JSON.stringify({
						emails: filteredEmails.length,
						timestamp,
						account: 'productions',
						type: 'business-emails'
					})
				);
			});
			
			// Phase 4: Send notifications about business emails
			await step.do('notify-business-team', async () => {
				return await fetch('https://claude-webhook.mobicycle.productions/notify', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						type: 'new-business-emails',
						count: filteredEmails.length,
						account: 'productions',
						emails: filteredEmails.map(e => ({ 
							from: e.from, 
							subject: e.subject,
							priority: this.calculateEmailPriority(e)
						}))
					})
				});
			});
			
			// Phase 5: Shortlist email by business priority
			const shortlistedEmail = await step.do('shortlist-business-email', async () => {
				return this.selectByBusinessPriority(filteredEmails);
			});
			
			// Phase 6: Extract business context
			const context = await step.do('extract-business-context', async () => {
				return await this.extractBusinessContext(shortlistedEmail, allEmails);
			});
			
			// Phase 7: Classify business complexity
			const classification = await step.do('classify-business-email', {
				retries: { 
					limit: 3,
					delay: '15s',  // Faster retry for business emails
					backoff: 'exponential'
				}
			}, async () => {
				return await this.classifyBusinessComplexity(shortlistedEmail, context);
			});
			
			console.log(`[PRODUCTIONS] Email classified as: ${classification.level} (${classification.category})`);
			
			// Phase 8: Handle based on business classification
			switch (classification.level) {
				case 'no-action':
					await step.do('close-business-no-action', async () => {
						return await this.env.BUSINESS_CASES.put(
							`case-${shortlistedEmail.id}`,
							JSON.stringify({
								status: 'closed',
								reason: 'no-action',
								classification,
								timestamp: new Date().toISOString(),
								account: 'productions'
							})
						);
					});
					return { 
						status: 'closed-no-action', 
						emailId: shortlistedEmail.id,
						account: 'productions'
					};
					
				case 'low-complexity':
					return await this.handleBusinessLowComplexity(step, shortlistedEmail, context, classification);
					
				case 'high-complexity':
					return await this.handleBusinessHighComplexity(step, shortlistedEmail, context, classification);
					
				default:
					throw new Error(`Unknown classification: ${classification.level}`);
			}
			
		} catch (error) {
			console.error('[PRODUCTIONS] Business workflow failed:', error);
			await step.do('handle-business-error', async () => {
				await this.env.BUSINESS_CASES.put(
					`error-${batchId}`,
					JSON.stringify({
						error: error.message,
						timestamp: new Date().toISOString(),
						account: 'productions'
					})
				);
			});
			throw error;
		}
	}
	
	private calculateEmailPriority(email: Email): 'low' | 'medium' | 'high' | 'urgent' {
		const subject = email.subject.toLowerCase();
		const body = email.body.toLowerCase();
		
		// Urgent business keywords
		const urgentKeywords = ['urgent', 'asap', 'emergency', 'critical', 'deadline today'];
		if (urgentKeywords.some(keyword => subject.includes(keyword) || body.includes(keyword))) {
			return 'urgent';
		}
		
		// High priority business keywords
		const highKeywords = ['invoice', 'payment', 'contract', 'deadline', 'complaint'];
		if (highKeywords.some(keyword => subject.includes(keyword) || body.includes(keyword))) {
			return 'high';
		}
		
		// Medium priority business keywords  
		const mediumKeywords = ['order', 'delivery', 'quote', 'proposal', 'meeting'];
		if (mediumKeywords.some(keyword => subject.includes(keyword) || body.includes(keyword))) {
			return 'medium';
		}
		
		return 'low';
	}
	
	private selectByBusinessPriority(emails: Email[]): Email {
		// Sort by business priority, then by date
		return emails.sort((a, b) => {
			const priorityA = this.calculateEmailPriority(a);
			const priorityB = this.calculateEmailPriority(b);
			
			const priorityOrder = { 'urgent': 4, 'high': 3, 'medium': 2, 'low': 1 };
			const priorityDiff = priorityOrder[priorityB] - priorityOrder[priorityA];
			
			if (priorityDiff !== 0) return priorityDiff;
			
			// If same priority, sort by date (newest first)
			return new Date(b.date).getTime() - new Date(a.date).getTime();
		})[0];
	}
	
	private async handleBusinessLowComplexity(
		step: WorkflowStep,
		email: Email,
		context: BusinessContext,
		classification: BusinessClassification
	) {
		// Generate business response using Claude
		const response = await step.do('generate-business-response', {
			retries: { limit: 2, delay: '5s' }
		}, async () => {
			return await this.generateBusinessResponse(email, context, classification);
		});
		
		// Send response via ProtonMail Bridge
		await step.do('send-business-response', {
			retries: { limit: 3, delay: '3s' }
		}, async () => {
			return await fetch('https://mail.mobicycle.productions/send-email', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					from: 'suppliers@mobicycle.productions',
					to: email.from,
					subject: `Re: ${email.subject}`,
					text: response,
					references: email.messageId
				})
			});
		});
		
		// Update supplier database if relevant
		if (classification.category === 'supplier') {
			await step.do('update-supplier-record', async () => {
				return await this.updateSupplierRecord(email, context);
			});
		}
		
		// Mark business case as completed
		await step.do('close-business-case', async () => {
			await this.env.BUSINESS_CASES.put(
				`case-${email.id}`,
				JSON.stringify({
					status: 'completed',
					type: 'low-complexity-business',
					category: classification.category,
					response,
					timestamp: new Date().toISOString(),
					account: 'productions'
				})
			);
		});
		
		return {
			status: 'completed-low-complexity',
			emailId: email.id,
			account: 'productions',
			category: classification.category,
			response
		};
	}
	
	private async handleBusinessHighComplexity(
		step: WorkflowStep,
		email: Email,
		context: BusinessContext,
		classification: BusinessClassification
	) {
		console.log(`[PRODUCTIONS] Handling high-complexity ${classification.category} case`);
		
		// Generate business documents with retry
		const documents = await step.do('generate-business-docs', {
			retries: {
				limit: 3,
				delay: '30s',
				backoff: 'exponential'
			}
		}, async () => {
			return await this.generateBusinessDocuments(email, context, classification);
		});
		
		// Request approval (faster turnaround than legal)
		const approvalId = `business-approval-${email.id}-${Date.now()}`;
		
		await step.do('request-business-approval', async () => {
			await this.env.APPROVAL_QUEUE.put(approvalId, JSON.stringify({
				type: 'business-document-review',
				email,
				context,
				classification,
				documents,
				requestedAt: new Date().toISOString(),
				account: 'productions'
			}));
			
			// Notify business team
			return await fetch('https://claude-webhook.mobicycle.productions/approval-needed', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					approvalId,
					type: 'business-documents',
					priority: context.priority,
					category: classification.category,
					case: {
						from: email.from,
						subject: email.subject,
						complexity: 'high'
					},
					documentsCount: documents.length
				})
			});
		});
		
		// PAUSE - Wait for business approval (faster than legal - 48 hours max)
		const approval = await step.sleep('business-approval', approvalId);
		
		if (!approval.approved) {
			await step.do('handle-business-rejection', async () => {
				await this.env.BUSINESS_CASES.put(
					`case-${email.id}`,
					JSON.stringify({
						status: 'rejected',
						reason: approval.reason,
						rejectedAt: new Date().toISOString(),
						account: 'productions'
					})
				);
			});
			return {
				status: 'rejected-by-business-team',
				emailId: email.id,
				reason: approval.reason,
				account: 'productions'
			};
		}
		
		// Proceed with approved business documents
		const finalDocuments = approval.modifiedDocuments || documents;
		
		// Submit to business systems (suppliers, customers, etc.)
		const submissions = await step.do('business-submissions', {
			retries: {
				limit: 5,
				delay: '60s',
				backoff: 'exponential',
				maxDelay: '600s' // 10 minutes max
			}
		}, async () => {
			return await this.submitToBusinessSystems(finalDocuments, context, classification);
		});
		
		// Upload to business document system
		await step.do('upload-to-business-docs', {
			retries: { limit: 3, delay: '15s' }
		}, async () => {
			return await this.uploadToBusinessDocs(finalDocuments, email, context);
		});
		
		// Update supplier records if applicable
		if (classification.category === 'supplier') {
			await step.do('update-supplier-final', async () => {
				return await this.updateSupplierRecord(email, context, finalDocuments);
			});
		}
		
		// Final business case documentation
		await step.do('finalize-business-case', async () => {
			await this.env.BUSINESS_CASES.put(
				`case-${email.id}`,
				JSON.stringify({
					status: 'completed',
					type: 'high-complexity-business',
					category: classification.category,
					documents: finalDocuments.map(d => d.filename),
					submissions,
					completedAt: new Date().toISOString(),
					account: 'productions'
				})
			);
		});
		
		return {
			status: 'completed-high-complexity',
			emailId: email.id,
			account: 'productions',
			category: classification.category,
			documents: finalDocuments,
			submissions
		};
	}
	
	// Business-specific methods for Productions account
	private async extractBusinessContext(email: Email, allEmails: Email[]): Promise<BusinessContext> {
		const businessKeywords = this.extractBusinessKeywords(email.body);
		const supplierIds = this.extractSupplierIds(email.body);
		const orderNumbers = this.extractOrderNumbers(email.body);
		const businessAddresses = this.extractBusinessAddresses(email);
		const relatedEmails = this.findRelatedBusinessEmails(email, allEmails);
		const priority = this.calculateEmailPriority(email);
		
		return {
			keywords: businessKeywords,
			addresses: businessAddresses,
			supplierIds,
			orderNumbers,
			relatedEmails,
			priority
		};
	}
	
	private extractBusinessKeywords(body: string): string[] {
		const businessTerms = [
			'invoice', 'payment', 'order', 'delivery', 'shipment',
			'quote', 'proposal', 'contract', 'supplier', 'vendor',
			'purchase', 'procurement', 'inventory', 'stock', 'customer',
			'service', 'support', 'complaint', 'refund', 'return'
		];
		
		return businessTerms.filter(term => 
			body.toLowerCase().includes(term.toLowerCase())
		);
	}
	
	private extractSupplierIds(body: string): string[] {
		const supplierRegex = /supplier\s*(?:id|number)\s*:?\s*([a-z0-9\-]+)/gi;
		const matches = body.match(supplierRegex) || [];
		return matches.map(match => match.trim());
	}
	
	private extractOrderNumbers(body: string): string[] {
		const orderRegex = /(?:order|po|purchase)\s*(?:number|no\.?|#)\s*:?\s*([a-z0-9\-]+)/gi;
		const matches = body.match(orderRegex) || [];
		return matches.map(match => match.trim());
	}
	
	private extractBusinessAddresses(email: Email): string[] {
		const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
		const emails = email.body.match(emailRegex) || [];
		return [...new Set([email.from, ...emails])];
	}
	
	private findRelatedBusinessEmails(email: Email, allEmails: Email[]): Email[] {
		return allEmails.filter(otherEmail => {
			if (otherEmail.id === email.id) return false;
			
			const subjectSimilarity = this.calculateBusinessSubjectSimilarity(
				email.subject, 
				otherEmail.subject
			);
			
			const sameParties = otherEmail.from === email.from || 
							   otherEmail.to === email.from;
			
			return subjectSimilarity > 0.6 || sameParties;
		});
	}
	
	private calculateBusinessSubjectSimilarity(subject1: string, subject2: string): number {
		const words1 = subject1.toLowerCase().split(/\W+/);
		const words2 = subject2.toLowerCase().split(/\W+/);
		
		const intersection = words1.filter(word => 
			words2.includes(word) && word.length > 2
		);
		
		return intersection.length / Math.max(words1.length, words2.length);
	}
	
	private async classifyBusinessComplexity(
		email: Email, 
		context: BusinessContext
	): Promise<BusinessClassification> {
		const response = await this.env.AI.run('@cf/meta/llama-2-7b-chat-int8', {
			messages: [{
				role: 'user',
				content: `Classify this business email's complexity and category:
				
From: ${email.from}
Subject: ${email.subject}
Keywords: ${context.keywords.join(', ')}
Supplier IDs: ${context.supplierIds.join(', ')}
Order Numbers: ${context.orderNumbers.join(', ')}
Priority: ${context.priority}

Classify complexity as: no-action, low-complexity, or high-complexity
Classify category as: supplier, customer, internal, compliance, or financial
Provide reasoning.`
			}]
		});
		
		const text = response.response.toLowerCase();
		
		let level: BusinessClassification['level'];
		if (text.includes('no-action')) {
			level = 'no-action';
		} else if (text.includes('low-complexity')) {
			level = 'low-complexity';
		} else {
			level = 'high-complexity';
		}
		
		let category: BusinessClassification['category'] = 'internal';
		if (text.includes('supplier')) category = 'supplier';
		else if (text.includes('customer')) category = 'customer';
		else if (text.includes('compliance')) category = 'compliance';
		else if (text.includes('financial')) category = 'financial';
		
		return {
			level,
			category,
			reasoning: response.response,
			confidence: 0.8
		};
	}
	
	private async generateBusinessResponse(
		email: Email, 
		context: BusinessContext,
		classification: BusinessClassification
	): Promise<string> {
		const response = await this.env.AI.run('@cf/meta/llama-2-7b-chat-int8', {
			messages: [{
				role: 'user',
				content: `Generate a professional business response to this ${classification.category} email:

From: ${email.from}
Subject: ${email.subject}
Body: ${email.body.substring(0, 500)}...

Context:
- Business keywords: ${context.keywords.join(', ')}
- Priority: ${context.priority}
- Category: ${classification.category}

Write a professional response from suppliers@mobicycle.productions`
			}]
		});
		
		return response.response;
	}
	
	private async generateBusinessDocuments(
		email: Email, 
		context: BusinessContext,
		classification: BusinessClassification
	): Promise<any[]> {
		// Generate business documents (contracts, invoices, etc.)
		throw new Error('Business document generation not implemented yet');
	}
	
	private async submitToBusinessSystems(
		documents: any[], 
		context: BusinessContext,
		classification: BusinessClassification
	): Promise<any[]> {
		// Submit to business systems, supplier portals, etc.
		throw new Error('Business system submission not implemented yet');
	}
	
	private async uploadToBusinessDocs(
		documents: any[], 
		email: Email, 
		context: BusinessContext
	): Promise<void> {
		const response = await fetch(`${this.env.BUSINESS_DOCS_URL}/upload`, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${this.env.BUSINESS_DOCS_API_KEY}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				documents,
				case: {
					emailId: email.id,
					from: email.from,
					subject: email.subject,
					context
				},
				account: 'productions'
			})
		});
		
		if (!response.ok) {
			throw new Error(`Business docs upload failed: ${response.status}`);
		}
	}
	
	private async updateSupplierRecord(
		email: Email, 
		context: BusinessContext, 
		documents?: any[]
	): Promise<void> {
		// Update supplier database with new information
		const supplierData = {
			email: email.from,
			lastContact: new Date().toISOString(),
			supplierIds: context.supplierIds,
			orderNumbers: context.orderNumbers,
			documents: documents?.map(d => d.filename) || []
		};
		
		await this.env.SUPPLIER_DATABASE.put(
			`supplier-${email.from}`,
			JSON.stringify(supplierData)
		);
	}
}

export default EmailTriageWorkflow;