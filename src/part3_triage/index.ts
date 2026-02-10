export type TriageLevel = 'NO_ACTION' | 'SIMPLE' | 'LOW_COMPLEX' | 'HIGH_COMPLEX';

export interface TriageDecision {
  key: string;
  from: string;
  subject: string;
  date: string;
  namespace: string;
  level: TriageLevel;
  reason: string;
  suggestedAction?: string;
}

const NO_ACTION_SIGNALS = [
  'delivery notification', 'read receipt', 'out of office',
  'automatic reply', 'undeliverable', 'noreply', 'no-reply',
];

const HIGH_COMPLEX_NAMESPACES = [
  'EMAIL_RECONSIDERATION_CPR52_24_5', 'EMAIL_RECONSIDERATION_CPR52_24_6',
  'EMAIL_RECONSIDERATION_CPR52_30', 'EMAIL_RECONSIDERATION_PD52B',
  'EMAIL_COURTS_SUPREME_COURT',
];

const LOW_COMPLEX_NAMESPACES = [
  'EMAIL_COURTS_COURT_OF_APPEALS_CIVIL_DIVISION', 'EMAIL_COURTS_KINGS_BENCH_APPEALS_DIVISION',
  'EMAIL_COURTS_CHANCERY_DIVISION', 'EMAIL_COURTS_CENTRAL_LONDON_COUNTY_COURT',
  'EMAIL_COURTS_CLERKENWELL_COUNTY_COURT', 'EMAIL_COURTS_ADMINISTRATIVE_COURT',
  'EMAIL_COMPLAINTS', 'EMAIL_REGULATORS',
];

export function triageEmail(
  key: string,
  email: { from: string; to: string; subject: string; date: string; body: string; namespaces: string[] },
): TriageDecision {
  const subjectLower = email.subject.toLowerCase();
  const fromLower = email.from.toLowerCase();
  const ns0 = email.namespaces[0] || 'UNKNOWN';

  for (const signal of NO_ACTION_SIGNALS) {
    if (subjectLower.includes(signal) || fromLower.includes(signal)) {
      return { key, from: email.from, subject: email.subject, date: email.date, namespace: ns0, level: 'NO_ACTION', reason: 'Auto-dismiss: matches signal "' + signal + '"' };
    }
  }

  for (const ns of email.namespaces) {
    if (HIGH_COMPLEX_NAMESPACES.includes(ns)) {
      return { key, from: email.from, subject: email.subject, date: email.date, namespace: ns0, level: 'HIGH_COMPLEX', reason: 'Namespace ' + ns + ' requires full pipeline processing', suggestedAction: ns.includes('RECONSIDERATION') ? 'Generate response document + CE-File submission' : 'Draft application with attachments for court filing' };
    }
  }

  for (const ns of email.namespaces) {
    if (LOW_COMPLEX_NAMESPACES.includes(ns)) {
      return { key, from: email.from, subject: email.subject, date: email.date, namespace: ns0, level: 'LOW_COMPLEX', reason: 'Namespace ' + ns + ' requires letter or formal response', suggestedAction: 'Draft formal letter' };
    }
  }

  return { key, from: email.from, subject: email.subject, date: email.date, namespace: ns0, level: 'SIMPLE', reason: 'Standard correspondence - acknowledge and file', suggestedAction: 'Draft acknowledgement email' };
}

export async function triageNamespace(namespace: KVNamespace, namespaceName: string): Promise<TriageDecision[]> {
  const decisions: TriageDecision[] = [];
  const keys = await namespace.list();
  for (const key of keys.keys) {
    const raw = await namespace.get(key.name);
    if (!raw) continue;
    const email = JSON.parse(raw);
    if (email.status !== 'pending') continue;
    decisions.push(triageEmail(key.name, {
      from: email.from || '', to: email.to || '', subject: email.subject || '',
      date: email.date || '', body: email.body || '', namespaces: email.namespaces || [namespaceName],
    }));
  }
  return decisions;
}
