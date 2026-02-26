**Dashboard KPIs:**
- `/api/kpi/total-emails` - Total email count across all accounts
- `/api/kpi/total-accounts` - Number of email accounts
- `/api/kpi/active-namespaces` - Active KV namespace count
- `/api/metrics/sent-vs-received` - Sent vs received ratio
- `/api/namespaces/summary` - Complete namespace summary with stats

**Data Flow Monitoring:**
- `/api/flow/sync-status` - Compare KV stored data vs ProtonMail Bridge data
- `/api/flow/pipeline-health` - Overall pipeline health status

**Legacy Endpoints:**
- `/fetch-emails` (POST) - Fetch emails from ProtonMail Bridge IMAP
- `/send-email` (POST) - Send email via ProtonMail Bridge SMTP
- `/email-count` (GET) - Get email count for a specific mailbox
- `/list-folders` (GET) - List all IMAP folders
- `/folder-counts` (GET) - Get email counts for all folders
- `/health` (GET) - Health check for the service
- `/account-info` (GET) - Get account information and email addresses
- `/account-stats` (GET) - Statistics for all accounts
- `/total-emails` (GET) - Total email count across all accounts
- `/emails-per-folder` (GET) - Email count per folder across all accounts

**Email-Specific Queries (Sent):**
- `/sent-by-rose@mobicycle.ee` (GET) - Sent count for rose@mobicycle.ee
- `/sent-by-rose@mobicycle.consulting` (GET) - Sent count for rose@mobicycle.consulting
- `/sent-by-rose@mobicycle.us` (GET) - Sent count for rose@mobicycle.us
- `/sent-by-rose@mobicycle.productions` (GET) - Sent count for rose@mobicycle.productions

**Email-Specific Queries (Received):**
- `/sent-to-rose@mobicycle.ee` (GET) - Received count for rose@mobicycle.ee
- `/sent-to-rose@mobicycle.consulting` (GET) - Received count for rose@mobicycle.consulting
- `/sent-to-rose@mobicycle.productions` (GET) - Received count for rose@mobicycle.productions
- `/sent-to-rose@mobicycle.us` (GET) - Received count for rose@mobicycle.us

**Email-Specific Queries (Received, Excluding Spam):**
- `/sent-to-rose@mobicycle.ee-no-spam` (GET) - Received count excluding spam
- `/sent-to-rose@mobicycle.consulting-no-spam` (GET) - Received count excluding spam
- `/sent-to-rose@mobicycle.productions-no-spam` (GET) - Received count excluding spam
- `/sent-to-rose@mobicycle.us-no-spam` (GET) - Received count excluding spam

**Dynamic Label-Based Endpoints:**
- `/label-sent/{label}?email=` (GET) - Sent count by label for specific email
- `/label-received/{label}?email=` (GET) - Received count by label for specific email

**KV Namespace Endpoints:**
- `/kv-stats/{namespace-title}` (GET) - Stats for a specific KV namespace
- `/kv-namespaces` (GET) - List all KV namespace definitions (19 namespaces)
- `/kv-compare` (GET) - Compare KV stored data with actual email counts from Bridge

**GraphQL:**
- `/graphql` (GET) - GraphQL playground/explorer interface
- `/graphql` (POST) - Execute GraphQL queries

**Root:**
- `/` (GET) - Service info and complete endpoint listing