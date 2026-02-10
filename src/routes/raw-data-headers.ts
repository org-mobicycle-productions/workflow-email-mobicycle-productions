import type { Env } from '../shared/types';

export async function handleRawDataHeaders(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  
  if (request.method === 'DELETE') {
    // Clear all raw data
    const { keys } = await env.RAW_DATA_HEADERS.list();
    let deleted = 0;
    
    for (const key of keys) {
      await env.RAW_DATA_HEADERS.delete(key.name);
      deleted++;
    }
    
    return Response.json({ deleted, message: 'All raw data cleared' });
  }
  
  if (request.method === 'POST') {
    // Manually add email to raw data (for testing)
    const body = await request.json();
    const key = `manual-${Date.now()}`;
    
    const emailData = {
      ...body,
      status: 'raw',
      addedAt: new Date().toISOString(),
      source: 'manual'
    };
    
    await env.RAW_DATA_HEADERS.put(key, JSON.stringify(emailData));
    return Response.json({ key, message: 'Email added to raw data' });
  }
  
  // GET: List raw emails
  const { keys } = await env.RAW_DATA_HEADERS.list({ limit: limit + offset });
  const emails = [];
  
  const targetKeys = keys.slice(offset, offset + limit);
  
  for (const key of targetKeys) {
    const raw = await env.RAW_DATA_HEADERS.get(key.name);
    if (raw) {
      const email = JSON.parse(raw);
      emails.push({
        key: key.name,
        subject: email.subject || 'No Subject',
        from: email.from || 'Unknown',
        date: email.date,
        status: email.status || 'raw',
        size: new Blob([raw]).size
      });
    }
  }
  
  return Response.json({
    total: keys.length,
    showing: emails.length,
    offset,
    limit,
    emails
  });
}