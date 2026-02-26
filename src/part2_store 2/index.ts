/**
 * Part 2: Store in KV namespaces
 * 
 * Takes inbound emails from Part 1.
 * Matches each email against classification rules.
 * Stores in RAW_DATA_HEADERS (all inbound).
 * Stores in FILTERED_DATA_HEADERS (matched only).
 * Routes to category-specific KV namespaces.
 */

import type { RawEmail } from '../part1_fetch/index';

// --- Key/Value formatting ---

export function formatKey(from: string, date: string): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  const sender = from.replace(/[@.]/g, '_').toLowerCase();
  return `${year}.${month}.${day}_${sender}_${hours}-${minutes}-${seconds}`;
}

export function formatValue(email: RawEmail, namespaces: string[]): string {
  return JSON.stringify({
    from: email.from,
    to: email.to,
    subject: email.subject,
    date: email.date,
    messageId: email.messageId,
    body: email.body,
    namespaces: namespaces,
    storedAt: new Date().toISOString(),
    status: 'pending',
  });
}

// --- Classification ---

interface Rule {
  namespace: string;
  priority: string;
  conditions: {
    fromIncludes?: string[];
    toIncludes?: string[];
    subjectIncludes?: string[];
  };
}

export function classify(
  email: RawEmail,
  rules: Rule[]
): { matched: boolean; namespaces: string[] } {
  const from = email.from.toLowerCase();
  const to = email.to.toLowerCase();
  const subject = email.subject.toLowerCase();
  const matched: string[] = [];

  for (const rule of rules) {
    const c = rule.conditions;
    let hit = false;

    if (c.fromIncludes) {
      for (const p of c.fromIncludes) {
        if (from.includes(p.toLowerCase())) { hit = true; break; }
      }
    }
    if (!hit && c.toIncludes) {
      for (const p of c.toIncludes) {
        if (to.includes(p.toLowerCase())) { hit = true; break; }
      }
    }
    if (!hit && c.subjectIncludes) {
      for (const p of c.subjectIncludes) {
        if (subject.includes(p.toLowerCase())) { hit = true; break; }
      }
    }

    if (hit) matched.push(rule.namespace);
  }

  return { matched: matched.length > 0, namespaces: [...new Set(matched)] };
}

// --- Storage ---

export interface StoreResult {
  rawStored: number;
  filteredStored: number;
  routeStats: Record<string, number>;
}

export async function storeEmails(
  emails: RawEmail[],
  rules: Rule[],
  env: Record<string, KVNamespace>
): Promise<StoreResult> {
  const raw = env['RAW_DATA_HEADERS'];
  const filtered = env['FILTERED_DATA_HEADERS'];
  let filteredCount = 0;
  const routeStats: Record<string, number> = {};

  for (const email of emails) {
    const key = formatKey(email.from, email.date);

    // All inbound -> RAW
    await raw.put(key, formatValue(email, []));

    // Classify
    const result = classify(email, rules);
    if (!result.matched) continue;

    filteredCount++;

    // Matched -> FILTERED
    await filtered.put(key, formatValue(email, result.namespaces));

    // Route to each matched namespace
    for (const ns of result.namespaces) {
      const namespace = env[ns];
      if (namespace) {
        await namespace.put(key, formatValue(email, result.namespaces));
        routeStats[ns] = (routeStats[ns] || 0) + 1;
      }
    }
  }

  return {
    rawStored: emails.length,
    filteredStored: filteredCount,
    routeStats,
  };
}

