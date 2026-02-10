/**
 * Part 1: Get emails from ProtonMail Bridge
 *
 * Chain: Worker → imap.mobicycle.ee (tunnel) → localhost:4000 (backend) → 127.0.0.1:1143 (bridge)
 *
 * checkTunnel()  — can we reach imap.mobicycle.ee?
 * checkBackend() — is localhost:4000 responding behind the tunnel?
 * checkBridge()  — is ProtonMail Bridge on 127.0.0.1:1143 connected?
 * fetchEmails()  — pull from "All Mail" and filter out Rose's sent
 */

const ROSE_ADDRESSES = [
  'rose@mobicycle.ee',
  'rose@mobicycle.productions',
  'rose@mobicycle.us',
  'rose@mobicycle.consulting',
  'rose@mobicycle.eu',
];

export interface RawEmail {
  from: string;
  to: string;
  subject: string;
  date: string;
  messageId: string;
  body: string;
}

export interface FetchResult {
  fetched: number;
  inbound: number;
  filtered: number;
  emails: RawEmail[];
}

export interface HopResult {
  ok: boolean;
  url: string;
  error?: string;
  detail?: any;
}

/**
 * Check hop 1: tunnel (imap.mobicycle.ee)
 */
export async function checkTunnel(tunnelUrl: string): Promise<HopResult> {
  try {
    const res = await fetch(tunnelUrl, { signal: AbortSignal.timeout(5000) });
    return { ok: res.ok, url: tunnelUrl };
  } catch (e: any) {
    return { ok: false, url: tunnelUrl, error: e.message };
  }
}

/**
 * Check hop 2: backend (localhost:4000 via tunnel)
 */
export async function checkBackend(tunnelUrl: string): Promise<HopResult> {
  try {
    const res = await fetch(`${tunnelUrl}/health`, { signal: AbortSignal.timeout(5000) });
    if (res.status === 502 || res.status === 504) {
      return { ok: false, url: 'localhost:4000', error: `tunnel returned ${res.status}` };
    }
    const data = (await res.json()) as any;
    return {
      ok: data.status === 'ok',
      url: 'localhost:4000',
      detail: { service: data.service, account: data.account },
    };
  } catch (e: any) {
    return { ok: false, url: 'localhost:4000', error: e.message };
  }
}

/**
 * Check hop 3: bridge (127.0.0.1:1143 via backend)
 */
export async function checkBridge(tunnelUrl: string): Promise<HopResult> {
  try {
    const res = await fetch(`${tunnelUrl}/health`, { signal: AbortSignal.timeout(5000) });
    const data = (await res.json()) as any;
    const bridgeAddr = data.config?.bridge || '127.0.0.1:1143';
    if (data.status !== 'ok') {
      return { ok: false, url: bridgeAddr, error: data.error || 'backend unhealthy' };
    }
    return { ok: true, url: bridgeAddr };
  } catch (e: any) {
    return { ok: false, url: '127.0.0.1:1143', error: e.message };
  }
}

/**
 * Fetch emails from ProtonMail Bridge and filter out Rose's sent.
 */
export async function fetchEmails(tunnelUrl: string): Promise<FetchResult> {
  const response = await fetch(`${tunnelUrl}/fetch-emails`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      folder: 'All Mail', 
      includeBody: true,
      excludeFolders: ['Spam', 'Junk', 'Trash', 'Deleted Items']
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`Backend returned ${response.status}`);
  }

  const data = (await response.json()) as any;
  const all: RawEmail[] = (data.emails || []).map((e: any) => ({
    from: e.from || '',
    to: e.to || '',
    subject: e.subject || '',
    date: e.date || new Date().toISOString(),
    messageId: e.messageId || '',
    body: e.body || '',
  }));

  // Keep ALL emails for RAW storage - no filtering
  const inbound = all;

  // Remove duplicates by messageId (emails should have unique messageId)
  const deduped = inbound.filter((email, index, arr) => {
    return arr.findIndex(e => e.messageId === email.messageId) === index;
  });

  return {
    fetched: all.length,
    inbound: deduped.length,
    filtered: 0, // No filtering at fetch stage
    emails: deduped,
  };
}
