import type { Env } from '../shared/types';

export async function handleFilteredDataHeaders(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const status = url.searchParams.get('status'); // filter by status
  
  if (request.method === 'DELETE') {
    // Clear all filtered data
    const { keys } = await env.FILTERED_DATA_HEADERS.list();
    let deleted = 0;
    
    for (const key of keys) {
      await env.FILTERED_DATA_HEADERS.delete(key.name);
      deleted++;
    }
    
    return Response.json({ deleted, message: 'All filtered data cleared' });
  }
  
  if (request.method === 'PUT') {
    // Bulk update status
    const { status: newStatus, keys: targetKeys } = await request.json();
    let updated = 0;
    
    for (const key of targetKeys) {
      const raw = await env.FILTERED_DATA_HEADERS.get(key);
      if (raw) {
        const email = JSON.parse(raw);
        email.status = newStatus;
        email.updatedAt = new Date().toISOString();
        await env.FILTERED_DATA_HEADERS.put(key, JSON.stringify(email));
        updated++;
      }
    }
    
    return Response.json({ updated, message: `Updated ${updated} emails to status: ${newStatus}` });
  }
  
  // GET: List filtered emails
  const { keys } = await env.FILTERED_DATA_HEADERS.list({ limit: limit + offset });
  const emails = [];
  
  const targetKeys = keys.slice(offset, offset + limit);
  
  for (const key of targetKeys) {
    const raw = await env.FILTERED_DATA_HEADERS.get(key.name);
    if (raw) {
      const email = JSON.parse(raw);
      
      // Filter by status if specified
      if (status && email.status !== status) continue;
      
      emails.push({
        key: key.name,
        subject: email.subject || 'No Subject',
        from: email.from || 'Unknown',
        date: email.date,
        status: email.status || 'filtered',
        priority: email.priority,
        category: email.category,
        relevanceScore: email.relevanceScore,
        whitelistMatched: email.whitelistMatched,
        triageLevel: email.triageLevel,
        size: new Blob([raw]).size
      });
    }
  }
  
  // Count by status
  const statusCounts: Record<string, number> = {};
  for (const key of keys) {
    const raw = await env.FILTERED_DATA_HEADERS.get(key.name);
    if (raw) {
      const email = JSON.parse(raw);
      const emailStatus = email.status || 'filtered';
      statusCounts[emailStatus] = (statusCounts[emailStatus] || 0) + 1;
    }
  }
  
  return Response.json({
    total: keys.length,
    showing: emails.length,
    offset,
    limit,
    statusFilter: status,
    statusCounts,
    emails
  });
}