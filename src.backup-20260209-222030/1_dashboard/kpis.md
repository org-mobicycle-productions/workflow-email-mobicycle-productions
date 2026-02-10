# MobiCycle Email Workflow - Key Performance Indicators (KPIs)

## Core Bridge Status KPIs
- **Bridge Process Status**: ✓/✗ Is ProtonMail Bridge running
- **IMAP Connectivity**: ✓/✗ Port 1144 accessible
- **SMTP Connectivity**: ✓/✗ Port 1026 accessible
- **Bridge Uptime**: Hours since last restart
- **Authentication Status**: ✓/✗ Authenticated with Proton servers

## Tunnel Health KPIs
- **Tunnel Status**: ✓/✗ Cloudflare tunnel active
- **Tunnel URL**: Current tunnel endpoint
- **Connection Quality**: Latency/packet loss metrics
- **Reconnection Count**: Unexpected tunnel restarts
- **TLS Health**: Certificate validity and negotiation status

## Email Processing KPIs
- **Emails Retrieved Today**: Count of emails processed
- **Processing Success Rate**: % of successful email retrievals
- **Average Processing Time**: Time from retrieval to completion
- **Queue Length**: Pending emails awaiting processing
- **Error Rate**: Failed processing attempts per hour

## Performance Metrics
- **CPU Usage**: Bridge process CPU utilization
- **Memory Usage**: Bridge process memory consumption
- **Disk I/O**: Email storage read/write operations
- **Network Throughput**: Data transfer rates
- **Response Time**: API endpoint response latency

## Workflow Operational KPIs
- **Workflow Health**: ✓/✗ Worker running without errors
- **Last Execution**: Timestamp of last successful run
- **Cron Trigger Status**: ✓/✗ Scheduled execution active
- **KV Namespace Health**: ✓/✗ Storage bindings accessible
- **Environment Variables**: Configuration completeness

## Error & Alert Metrics
- **Critical Errors**: System-breaking failures
- **Warning Count**: Non-critical issues requiring attention
- **Authentication Failures**: Login/token refresh errors
- **Connection Timeouts**: Network connectivity issues
- **Data Corruption Events**: Email integrity failures

## Business Metrics
- **Email Volume**: Messages processed per time period
- **Attachment Processing**: Files downloaded and processed
- **Categorization Accuracy**: Proper email sorting success rate
- **Duplicate Detection**: Redundant email prevention rate
- **Storage Efficiency**: Data compression and deduplication

## Availability & Reliability
- **System Uptime**: Overall service availability percentage
- **MTTR (Mean Time to Repair)**: Average recovery time from failures
- **MTBF (Mean Time Between Failures)**: System reliability measure
- **Backup Success Rate**: Data backup completion percentage
- **Disaster Recovery Readiness**: System restoration capability

## Cost & Resource Optimization
- **Cloudflare Worker Invocations**: Billable execution count
- **Data Transfer Costs**: Bandwidth usage charges
- **Storage Costs**: KV namespace usage fees
- **Compute Time**: Worker execution duration
- **Resource Utilization**: Efficiency of allocated resources

## Security & Compliance KPIs
- **TLS Certificate Validity**: Encryption status
- **Token Refresh Success**: Authentication renewal rate
- **Access Log Integrity**: Security audit trail completeness
- **Data Encryption Status**: End-to-end protection verification
- **Compliance Score**: Regulatory requirement adherence