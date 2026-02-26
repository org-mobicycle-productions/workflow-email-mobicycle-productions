#!/bin/bash
# Generate KV key from email metadata
# Format: {year}.{day}.{month}_{sanitized-sender}_{hours}-{minutes}-{seconds}

from="$1"
date="$2"

# Parse date: 2026-02-09T10:30:45Z
year=$(echo "$date" | cut -d'-' -f1)
month=$(echo "$date" | cut -d'-' -f2)
day=$(echo "$date" | cut -d'T' -f1 | cut -d'-' -f3)
time=$(echo "$date" | cut -d'T' -f2 | cut -d'Z' -f1)
hours=$(echo "$time" | cut -d':' -f1)
minutes=$(echo "$time" | cut -d':' -f2)
seconds=$(echo "$time" | cut -d':' -f3)

# Sanitize sender: casework@ico.org.uk → casework_ico_org_uk
sender=$(echo "$from" | sed 's/[@.]/_/g')

# Output key
echo "${year}.${day}.${month}_${sender}_${hours}-${minutes}-${seconds}"
