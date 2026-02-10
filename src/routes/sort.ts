import type { Env } from '../shared/types';
import { WhitelistEngine } from '../shared/whitelist-engine';

interface EmailSortResult {
  key: string;
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'LEGAL' | 'COURT' | 'GOVERNMENT' | 'NOTIFICATION' | 'SPAM';
  relevanceScore: number;
  whitelistMatched: boolean;
  whitelistRule?: string;
  sortedAt: string;
}

export async function handleSort(request: Request, env: Env): Promise<Response> {
  const emails: EmailSortResult[] = [];
  const whitelistEngine = new WhitelistEngine();
  
  // Get all filtered emails
  const { keys } = await env.FILTERED_DATA_HEADERS.list();
  
  for (const key of keys.slice(0, 50)) { // Process most recent 50
    const raw = await env.FILTERED_DATA_HEADERS.get(key.name);
    if (!raw) continue;
    
    const email = JSON.parse(raw);
    if (email.status !== 'filtered') continue;
    
    const classification = whitelistEngine.classify(email);
    
    if (request.method === 'POST') {
      // Update email with classification metadata
      email.priority = classification.priority;
      email.category = classification.category;
      email.relevanceScore = classification.score;
      email.whitelistMatched = classification.matched;
      email.whitelistRule = classification.rule?.id;
      email.action = classification.action;
      email.sortedAt = new Date().toISOString();
      email.status = 'sorted';
      
      await env.FILTERED_DATA_HEADERS.put(key.name, JSON.stringify(email));
    }
    
    emails.push({
      key: key.name,
      priority: classification.priority,
      category: classification.category,
      relevanceScore: classification.score,
      whitelistMatched: classification.matched,
      whitelistRule: classification.rule?.id,
      sortedAt: new Date().toISOString()
    });
  }
  
  // Sort by priority and relevance
  emails.sort((a, b) => {
    const priorityOrder = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    return (priorityOrder[b.priority] - priorityOrder[a.priority]) || 
           (b.relevanceScore - a.relevanceScore);
  });
  
  if (request.method === 'POST') {
    return Response.json({ sorted: emails.length, emails: emails.slice(0, 20) });
  }
  
  return Response.json({ 
    total: emails.length,
    urgent: emails.filter(e => e.priority === 'URGENT').length,
    high: emails.filter(e => e.priority === 'HIGH').length,
    medium: emails.filter(e => e.priority === 'MEDIUM').length,
    low: emails.filter(e => e.priority === 'LOW').length,
    whitelisted: emails.filter(e => e.whitelistMatched).length,
    emails: emails.slice(0, 20)
  });
}