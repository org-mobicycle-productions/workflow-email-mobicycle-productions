#!/bin/bash
# Generate KV value (JSON) from email data

from="$1"
to="$2"
subject="$3"
date="$4"
messageId="$5"
body="${6:-}"
namespace="${7:-UNCLASSIFIED}"

cat <<JSON
{
  "from": "$from",
  "to": "$to",
  "subject": "$subject",
  "body": "$body",
  "date": "$date",
  "messageId": "$messageId",
  "namespace": "$namespace",
  "storedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "status": "pending"
}
JSON
