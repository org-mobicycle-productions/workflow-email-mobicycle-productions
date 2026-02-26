
#!/usr/bin/env bun

/**
 * Populate all KV namespaces with email counts from ProtonMail Bridge
 * Uses Cloudflare API directly
 */

const ACCOUNT_ID = '2e4a7955aa124c38058cccd43902a8a5'; // MobiCycle OÜ
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const BACKEND_URL = 'http://localhost:4000';

// All 19 KV namespaces with their label mappings
const namespaces = [
  { id: '37c7b5e5e8a84e2a8e340cb0e1b39202', title: 'email-courts-administrative-court', label: 'Admin Court' },
  { id: '4272a9a3567b4827b3e6b07a9e0ec07b', title: 'email-courts-supreme-court', label: 'supreme_court' },
  { id: '0dd9a961f8e54104a1c784fdd736d354', title: 'email-courts-central-london-county-court', label: 'City of London' },
  { id: '450d57986f6b47bd8e6a9881d48b0222', title: 'email-courts-clerkenwell-county-court', label: 'Lower Courts - CCCL, Clerkenwell' },
  { id: '142319de0a894f6da1b35ebf457b910f', title: 'email-complaints-bar-standards-board', label: 'Bar Standards Board' },
  { id: '1f2e69dfa5db49959b5c8f98d87453d6', title: 'email-complaints-hmcts', label: 'Complaints - HMCTS' },
  { id: '36b5178e1c83446faab3953bc49da196', title: 'email-government-us-state-department', label: 'US Government' },
  { id: '61d3e5e7b3e94cfab6db2aca6d05869a', title: 'email-claimant-rentify', label: 'Rentify' },
  { id: '6569a3d0c87b4ad897280e25695a7858', title: 'email-claimant-hk-law', label: 'HK_Law' },
  { id: '38a222851c034b6ab8c018fcbd5c4079', title: 'email-defendants-defendant', label: 'Defendant' },
  { id: '25c9d3da2ba6446883842413b3daa814', title: 'email-defendants-barristers', label: 'Barristers' },
  { id: '6ed1b38a555a4517bb272013b6140acb', title: 'email-defendants-mobicycle-ou-only', label: 'mobicycle.eu' },
  { id: '2155671bd23047bb917a7af169640691', title: 'email-expenses-repairs', label: 'Repairs' },
  { id: '226bdfd1f03e46e6a48ae5b77c00a264', title: 'email-expenses-legal-fees-director', label: 'Legal' },
  { id: '300bb71748194533bd1b25288263aeba', title: 'email-reconsideration-single-judge', label: 'Single Judge' },
  { id: '3117bed7263743ab901115e7a0b5a803', title: 'email-reconsideration-cpr52-24-6', label: 'CPR 52.24(6)' },
  { id: '4598ae69628a49e2a17e1e0b56ad77e7', title: 'email-reconsideration-cpr52-30', label: 'CPR 52.30' },
  { id: '513fc3d8c841423d853123e0c6cdfb80', title: 'email-reconsideration-court-officer-review', label: 'Court Officer Review' },
  { id: '9caf10194efb4a4d8296ac730793960b', title: 'email-reconsideration-pd52b', label: 'PD52B' },
];

const accounts = [
  'rose@mobicycle.ee',
  'rose@mobicycle.eu',
  'rose@mobicycle.consulting',
  'rose@mobicycle.productions',
  'rose@mobicycle.us',
];

async function writeToKV(namespaceId: string, key: string, value: any) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(value),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to write to KV: ${response.status} ${error}`);
  }

  return response.json();
}

async function getEmailCounts(email: string, label: string) {
  const encodedEmail = encodeURIComponent(email);
  const encodedLabel = encodeURIComponent(label);

  const [sentResponse, receivedResponse] = await Promise.all([
    fetch(`${BACKEND_URL}/label-sent/${encodedLabel}?email=${encodedEmail}`),
    fetch(`${BACKEND_URL}/label-received/${encodedLabel}?email=${encodedEmail}`),
  ]);

  const sentData = await sentResponse.json();
  const receivedData = await receivedResponse.json();

  return {
    sent: sentData.sentEmails || 0,
    received: receivedData.receivedEmails || 0,
  };
}

async function populateNamespace(namespace: typeof namespaces[0]) {
  console.log(`\nPopulating ${namespace.title}...`);

  for (const email of accounts) {
    try {
      const counts = await getEmailCounts(email, namespace.label);

      const data = {
        email,
        label: namespace.label,
        sentEmails: counts.sent,
        receivedEmails: counts.received,
        lastUpdated: new Date().toISOString(),
      };

      await writeToKV(namespace.id, email, data);
      console.log(`  ✓ ${email}: sent=${counts.sent}, received=${counts.received}`);
    } catch (error) {
      console.error(`  ✗ ${email}: ${error.message}`);
    }
  }
}

async function main() {
  if (!API_TOKEN) {
    console.error('Error: CLOUDFLARE_API_TOKEN environment variable not set');
    process.exit(1);
  }

  console.log(`Populating ${namespaces.length} KV namespaces with email counts...\n`);
  console.log(`Account: ${ACCOUNT_ID}`);
  console.log(`Backend: ${BACKEND_URL}`);

  for (const namespace of namespaces) {
    await populateNamespace(namespace);
  }

  console.log('\n✅ All KV namespaces populated successfully!');
}

main().catch(console.error);
