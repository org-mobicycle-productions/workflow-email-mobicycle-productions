/**
 * Email Distributor Worker
 * Takes whitelisted emails and distributes them to their assigned KV namespaces
 */

import { getCompleteWhitelist, isEmailWhitelistedDetailed } from './whitelist-worker';

interface Email {
    id: string;
    from: string;
    to: string;
    subject: string;
    body: string;
    date: string;
    messageId: string;
}

interface Env {
    // All the KV namespaces from wrangler.toml
    EMAIL_CLAIMANT_HK_LAW: KVNamespace;
    EMAIL_CLAIMANT_LESSEL: KVNamespace;
    EMAIL_CLAIMANT_LIU: KVNamespace;
    EMAIL_CLAIMANT_RENTIFY: KVNamespace;
    EMAIL_COMPLAINTS_BAR_STANDARDS_BOARD: KVNamespace;
    EMAIL_COMPLAINTS_HMCTS: KVNamespace;
    EMAIL_COMPLAINTS_ICO: KVNamespace;
    EMAIL_COMPLAINTS_PARLIAMENT: KVNamespace;
    EMAIL_COMPLAINTS_PHSO: KVNamespace;
    EMAIL_COURTS_ADMINISTRATIVE_COURT: KVNamespace;
    EMAIL_COURTS_CENTRAL_LONDON_COUNTY_COURT: KVNamespace;
    EMAIL_COURTS_CHANCERY_DIVISION: KVNamespace;
    EMAIL_COURTS_CLERKENWELL_COUNTY_COURT: KVNamespace;
    EMAIL_COURTS_COURT_OF_APPEALS_CIVIL_DIVISION: KVNamespace;
    EMAIL_COURTS_KINGS_BENCH_APPEALS_DIVISION: KVNamespace;
    EMAIL_COURTS_SUPREME_COURT: KVNamespace;
    EMAIL_DEFENDANTS_BARRISTERS: KVNamespace;
    EMAIL_DEFENDANTS_BOTH_DEFENDANTS: KVNamespace;
    EMAIL_DEFENDANTS_DEFENDANT: KVNamespace;
    EMAIL_DEFENDANTS_LITIGANT_IN_PERSON_ONLY: KVNamespace;
    EMAIL_DEFENDANTS_MOBICYCLE_OU_ONLY: KVNamespace;
    EMAIL_EXPENSES_LEGAL_FEES_CLAIMANT: KVNamespace;
    EMAIL_EXPENSES_LEGAL_FEES_COMPANY: KVNamespace;
    EMAIL_EXPENSES_LEGAL_FEES_DIRECTOR: KVNamespace;
    EMAIL_EXPENSES_REPAIRS: KVNamespace;
    EMAIL_GOVERNMENT_ESTONIA: KVNamespace;
    EMAIL_GOVERNMENT_UK_LEGAL_DEPARTMENT: KVNamespace;
    EMAIL_GOVERNMENT_US_STATE_DEPARTMENT: KVNamespace;
    EMAIL_RECONSIDERATION_COURT_OFFICER_REVIEW: KVNamespace;
    EMAIL_RECONSIDERATION_CPR52_24_5: KVNamespace;
    EMAIL_RECONSIDERATION_CPR52_24_6: KVNamespace;
    EMAIL_RECONSIDERATION_CPR52_30: KVNamespace;
    EMAIL_RECONSIDERATION_PD52B: KVNamespace;
    EMAIL_RECONSIDERATION_PTA_REFUSAL: KVNamespace;
    EMAIL_RECONSIDERATION_SINGLE_JUDGE: KVNamespace;
}

// Map KV namespace names to actual KV bindings
function getKVNamespace(env: Env, namespaceName: string): KVNamespace | null {
    const mapping: { [key: string]: KVNamespace } = {
        'email-claimant-hk-law': env.EMAIL_CLAIMANT_HK_LAW,
        'email-claimant-lessel': env.EMAIL_CLAIMANT_LESSEL,
        'email-claimant-liu': env.EMAIL_CLAIMANT_LIU,
        'email-claimant-rentify': env.EMAIL_CLAIMANT_RENTIFY,
        'email-complaints-bar-standards-board': env.EMAIL_COMPLAINTS_BAR_STANDARDS_BOARD,
        'email-complaints-hmcts': env.EMAIL_COMPLAINTS_HMCTS,
        'email-complaints-ico': env.EMAIL_COMPLAINTS_ICO,
        'email-complaints-parliament': env.EMAIL_COMPLAINTS_PARLIAMENT,
        'email-complaints-phso': env.EMAIL_COMPLAINTS_PHSO,
        'email-courts-administrative-court': env.EMAIL_COURTS_ADMINISTRATIVE_COURT,
        'email-courts-central-london-county-court': env.EMAIL_COURTS_CENTRAL_LONDON_COUNTY_COURT,
        'email-courts-chancery-division': env.EMAIL_COURTS_CHANCERY_DIVISION,
        'email-courts-clerkenwell-county-court': env.EMAIL_COURTS_CLERKENWELL_COUNTY_COURT,
        'email-courts-court-of-appeals-civil-division': env.EMAIL_COURTS_COURT_OF_APPEALS_CIVIL_DIVISION,
        'email-courts-kings-bench-appeals-division': env.EMAIL_COURTS_KINGS_BENCH_APPEALS_DIVISION,
        'email-courts-supreme-court': env.EMAIL_COURTS_SUPREME_COURT,
        'email-defendants-barristers': env.EMAIL_DEFENDANTS_BARRISTERS,
        'email-defendants-both-defendants': env.EMAIL_DEFENDANTS_BOTH_DEFENDANTS,
        'email-defendants-defendant': env.EMAIL_DEFENDANTS_DEFENDANT,
        'email-defendants-litigant-in-person-only': env.EMAIL_DEFENDANTS_LITIGANT_IN_PERSON_ONLY,
        'email-defendants-mobicycle-ou-only': env.EMAIL_DEFENDANTS_MOBICYCLE_OU_ONLY,
        'email-expenses-legal-fees-claimant': env.EMAIL_EXPENSES_LEGAL_FEES_CLAIMANT,
        'email-expenses-legal-fees-company': env.EMAIL_EXPENSES_LEGAL_FEES_COMPANY,
        'email-expenses-legal-fees-director': env.EMAIL_EXPENSES_LEGAL_FEES_DIRECTOR,
        'email-expenses-repairs': env.EMAIL_EXPENSES_REPAIRS,
        'email-government-estonia': env.EMAIL_GOVERNMENT_ESTONIA,
        'email-government-uk-legal-department': env.EMAIL_GOVERNMENT_UK_LEGAL_DEPARTMENT,
        'email-government-us-state-department': env.EMAIL_GOVERNMENT_US_STATE_DEPARTMENT,
        'email-reconsideration-court-officer-review': env.EMAIL_RECONSIDERATION_COURT_OFFICER_REVIEW,
        'email-reconsideration-cpr52-24-5': env.EMAIL_RECONSIDERATION_CPR52_24_5,
        'email-reconsideration-cpr52-24-6': env.EMAIL_RECONSIDERATION_CPR52_24_6,
        'email-reconsideration-cpr52-30': env.EMAIL_RECONSIDERATION_CPR52_30,
        'email-reconsideration-pd52b': env.EMAIL_RECONSIDERATION_PD52B,
        'email-reconsideration-pta-refusal': env.EMAIL_RECONSIDERATION_PTA_REFUSAL,
        'email-reconsideration-single-judge': env.EMAIL_RECONSIDERATION_SINGLE_JUDGE,
    };
    
    return mapping[namespaceName] || null;
}

// Generate email key from email data
async function generateEmailKey(email: Email, kvNamespace: KVNamespace): Promise<string> {
    const emailDate = new Date(email.date);
    const year = emailDate.getUTCFullYear();
    const month = (emailDate.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = emailDate.getUTCDate().toString().padStart(2, '0');
    const dateStr = `${year}.${month}.${day}`;
    const hours = emailDate.getUTCHours().toString().padStart(2, '0');
    const minutes = emailDate.getUTCMinutes().toString().padStart(2, '0');
    const seconds = emailDate.getUTCSeconds().toString().padStart(2, '0');
    const senderKey = email.from;
    
    // Try without seconds first
    const baseKey = `${dateStr}_${senderKey}_${hours}:${minutes}`;
    const existing = await kvNamespace.get(baseKey);
    
    if (!existing) {
        return baseKey;
    }
    
    // If duplicate, add seconds
    return `${dateStr}_${senderKey}_${hours}:${minutes}:${seconds}`;
}

// Check daily rate limit (500 emails per day for free tier)
async function checkDailyRateLimit(env: Env): Promise<{ allowed: boolean; remaining: number; resetTime: string }> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const rateLimitKey = `rate-limit-${today}`;
    
    // Get today's count from KV (use EMAIL_COMPLAINTS_ICO as counter storage)
    const todayCountStr = await env.EMAIL_COMPLAINTS_ICO.get(rateLimitKey);
    const todayCount = todayCountStr ? parseInt(todayCountStr) : 0;
    
    const DAILY_LIMIT = 500;
    const remaining = Math.max(0, DAILY_LIMIT - todayCount);
    
    // Calculate reset time (midnight UTC)
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    
    return {
        allowed: todayCount < DAILY_LIMIT,
        remaining,
        resetTime: tomorrow.toISOString()
    };
}

// Update daily rate limit counter
async function updateDailyCounter(env: Env, count: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const rateLimitKey = `rate-limit-${today}`;
    
    // Get current count
    const currentCountStr = await env.EMAIL_COMPLAINTS_ICO.get(rateLimitKey);
    const currentCount = currentCountStr ? parseInt(currentCountStr) : 0;
    
    // Update with new count, expires at end of day
    const newCount = currentCount + count;
    const expirationTime = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours from now
    
    await env.EMAIL_COMPLAINTS_ICO.put(rateLimitKey, newCount.toString(), {
        expiration: expirationTime
    });
}

// Process and distribute emails with rate limiting
async function processEmails(emails: Email[], env: Env): Promise<any> {
    const whitelist = getCompleteWhitelist();
    const results = {
        processed: 0,
        whitelisted: 0,
        blocked: 0,
        stored: 0,
        rateLimited: 0,
        errors: [] as string[],
        rateLimit: {
            remaining: 0,
            resetTime: ''
        }
    };
    
    // Check rate limit before processing
    const rateLimit = await checkDailyRateLimit(env);
    results.rateLimit = {
        remaining: rateLimit.remaining,
        resetTime: rateLimit.resetTime
    };
    
    if (!rateLimit.allowed) {
        results.errors.push(`Daily rate limit of 500 emails exceeded. Resets at ${rateLimit.resetTime}`);
        return results;
    }
    
    // Sort emails by date (most recent first) before processing
    const sortedEmails = emails.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    // Limit emails to process based on remaining quota (prioritize most recent)
    const emailsToProcess = sortedEmails.slice(0, rateLimit.remaining);
    if (sortedEmails.length > rateLimit.remaining) {
        results.rateLimited = sortedEmails.length - rateLimit.remaining;
        results.errors.push(`Rate limited: ${results.rateLimited} emails deferred until tomorrow (oldest emails)`);
        console.log(`⚠️ Processing ${rateLimit.remaining} most recent emails, deferring ${results.rateLimited} oldest emails`);
    }
    
    for (const email of emailsToProcess) {
        results.processed++;
        
        // Check against whitelist
        const whitelistResult = isEmailWhitelistedDetailed(email.from, whitelist);
        
        if (whitelistResult.allowed && whitelistResult.tags?.kvNamespace) {
            results.whitelisted++;
            
            // Store in all assigned KV namespaces
            const storagePromises = whitelistResult.tags.kvNamespace.map(async (namespaceName) => {
                const kvNamespace = getKVNamespace(env, namespaceName);
                if (kvNamespace) {
                    try {
                        // Generate unique email key for this namespace
                        const emailKey = await generateEmailKey(email, kvNamespace);
                        
                        // Create email data
                        const emailData = {
                            originalId: email.id,
                            key: emailKey,
                            from: email.from,
                            to: email.to,
                            subject: email.subject,
                            body: email.body,
                            date: email.date,
                            messageId: email.messageId,
                            whitelistMatch: {
                                pattern: whitelistResult.matchedPattern,
                                categories: whitelistResult.categories,
                                tags: whitelistResult.tags
                            },
                            storedAt: new Date().toISOString()
                        };
                        
                        await kvNamespace.put(emailKey, JSON.stringify(emailData));
                        console.log(`✅ Stored email in ${namespaceName}: ${emailKey}`);
                        return { namespace: namespaceName, success: true };
                    } catch (error) {
                        console.error(`❌ Failed to store in ${namespaceName}:`, error);
                        results.errors.push(`Failed to store in ${namespaceName}: ${error}`);
                        return { namespace: namespaceName, success: false };
                    }
                } else {
                    const error = `KV namespace ${namespaceName} not found in bindings`;
                    console.error(error);
                    results.errors.push(error);
                    return { namespace: namespaceName, success: false };
                }
            });
            
            const storageResults = await Promise.all(storagePromises);
            const successfulStores = storageResults.filter(r => r.success).length;
            results.stored += successfulStores;
            
        } else {
            results.blocked++;
            console.log(`❌ Email blocked (not whitelisted): ${email.from}`);
        }
    }
    
    // Update daily counter with processed emails
    if (results.processed > 0) {
        await updateDailyCounter(env, results.processed);
        console.log(`📊 Updated daily counter: +${results.processed} emails processed today`);
    }
    
    return results;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        
        // Handle CORS
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                }
            });
        }
        
        // Allow DELETE for KV operations, GET for rate-limit/test, POST for distribution, and home page
        const isKvDelete = request.method === 'DELETE' && url.pathname.startsWith('/kv/');
        const isGetEndpoint = request.method === 'GET' && (url.pathname === '/rate-limit' || url.pathname === '/test' || url.pathname === '/');
        const isPostEndpoint = request.method === 'POST';
        
        if (!isKvDelete && !isGetEndpoint && !isPostEndpoint) {
            return new Response('Method not allowed', { status: 405 });
        }
        
        if (url.pathname === '/distribute-emails') {
            try {
                const { emails } = await request.json() as { emails: Email[] };
                
                if (!emails || !Array.isArray(emails)) {
                    return new Response('Invalid payload: emails array required', { status: 400 });
                }
                
                console.log(`📧 Processing ${emails.length} emails for distribution...`);
                
                const results = await processEmails(emails, env);
                
                return new Response(JSON.stringify({
                    success: true,
                    results,
                    message: `Processed ${results.processed} emails, ${results.whitelisted} whitelisted, ${results.stored} stored successfully`
                }), {
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                    }
                });
                
            } catch (error) {
                console.error('Error processing emails:', error);
                return new Response(JSON.stringify({
                    success: false,
                    error: error.message
                }), {
                    status: 500,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                    }
                });
            }
        }
        
        if (url.pathname === '/rate-limit') {
            // Check current rate limit status
            const rateLimit = await checkDailyRateLimit(env);
            
            return new Response(JSON.stringify({
                success: true,
                rateLimit: {
                    dailyLimit: 500,
                    remaining: rateLimit.remaining,
                    allowed: rateLimit.allowed,
                    resetTime: rateLimit.resetTime
                },
                message: rateLimit.allowed 
                    ? `${rateLimit.remaining} emails remaining today` 
                    : `Daily limit exceeded. Resets at ${rateLimit.resetTime}`
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                }
            });
        }
        
        // Handle KV deletion endpoint: DELETE /kv/{namespace}/{key}
        const kvDeleteMatch = url.pathname.match(/^\/kv\/([A-Z_]+)\/(.+)$/);
        if (request.method === 'DELETE' && kvDeleteMatch) {
            const [, namespaceName, key] = kvDeleteMatch;
            
            const kvNamespace = env[namespaceName as keyof Env] as KVNamespace;
            if (!kvNamespace) {
                return new Response(JSON.stringify({
                    success: false,
                    error: `Unknown namespace: ${namespaceName}`
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            
            try {
                await kvNamespace.delete(key);
                
                return new Response(JSON.stringify({
                    success: true,
                    message: `Deleted key "${key}" from namespace ${namespaceName}`
                }), {
                    headers: { 'Content-Type': 'application/json' }
                });
                
            } catch (error) {
                console.error('Error deleting KV entry:', error);
                return new Response(JSON.stringify({
                    success: false,
                    error: error.message
                }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }


        if (url.pathname === '/test') {
            // Test endpoint with sample emails
            const testEmails: Email[] = [
                {
                    id: "test-ico-001",
                    from: "casework@ico.org.uk",
                    to: "rose@mobicycle.ee",
                    subject: "Test ICO Data Protection Complaint",
                    body: "This is a test email for ICO casework distribution.",
                    date: new Date().toISOString(),
                    messageId: "<test-ico-001@ico.org.uk>"
                },
                {
                    id: "test-supreme-001",
                    from: "admin@supremecourt.uk",
                    to: "rose@mobicycle.ee",
                    subject: "Test Supreme Court Notice",
                    body: "This is a test email for Supreme Court distribution.",
                    date: new Date().toISOString(),
                    messageId: "<test-supreme-001@supremecourt.uk>"
                }
            ];
            
            const results = await processEmails(testEmails, env);
            
            return new Response(JSON.stringify({
                success: true,
                test: true,
                results,
                message: "Test distribution completed"
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                }
            });
        }
        
        return new Response('Email Distributor Worker\n\nEndpoints:\n- POST /distribute-emails\n- GET /rate-limit (check daily limit)\n- GET /test (test with sample emails)\n- DELETE /kv/{namespace}/{key} (delete KV entries)', {
            headers: { 'Content-Type': 'text/plain' }
        });
    }
};