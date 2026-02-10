# MobiCycle Email Workflow - KPI Tools & Functions Mapping

## Core Bridge Status KPIs

### Bridge Process Status
- **Function**: `checkBridgeProcess()`
- **Tool**: `ps aux | grep bridge` or `pgrep -f "proton.*bridge"`
- **API Endpoint**: `/api/bridge-status`
- **Expected Response**: `{"running": true, "pid": 12345}`

### IMAP Connectivity
- **Function**: `testIMAPConnection()`
- **Tool**: `telnet localhost 1144` or `nc -zv localhost 1144`
- **Code**: `new IMAPConnection({host: 'localhost', port: 1144})`
- **Expected Response**: `220 ProtonMail Bridge IMAP server ready`

### SMTP Connectivity  
- **Function**: `testSMTPConnection()`
- **Tool**: `telnet localhost 1026` or `nc -zv localhost 1026`
- **Code**: `new SMTPConnection({host: 'localhost', port: 1026})`
- **Expected Response**: `220 ProtonMail Bridge SMTP server ready`

### Bridge Uptime
- **Function**: `getBridgeUptime()`
- **Tool**: `ps -o lstart,etime -p $(pgrep bridge)`
- **API**: `/api/bridge-uptime`
- **Calculation**: Current time - process start time

### Authentication Status
- **Function**: `checkBridgeAuth()`
- **Tool**: Bridge CLI `bridge info` or `/health` endpoint
- **Log File**: `~/.cache/protonmail/bridge/logs/bridge.log`
- **Search Pattern**: `"Authentication successful"`

## Tunnel Health KPIs

### Tunnel Status
- **Function**: `checkCloudflaredStatus()`
- **Tool**: `ps aux | grep cloudflared` or `cloudflared tunnel list`
- **API**: `/api/tunnel-status`
- **Service Check**: `brew services list | grep cloudflared`

### Tunnel URL
- **Function**: `getTunnelURL()`
- **Tool**: `cloudflared tunnel info <tunnel-name>`
- **Config File**: `~/.cloudflared/config.yml`
- **Dashboard**: Cloudflare Zero Trust dashboard

### Connection Quality
- **Function**: `measureTunnelLatency()`
- **Tool**: `ping tunnel-hostname.trycloudflare.com`
- **Code**: `fetch(tunnelURL + '/health', {timeout: 5000})`
- **Metrics**: RTT, packet loss, jitter

### Reconnection Count
- **Function**: `countTunnelReconnects()`
- **Tool**: `grep "reconnect" ~/.cloudflared/logs/cloudflared.log`
- **Log Pattern**: `"connection.*reconnect"`
- **Time Window**: Last 24 hours

### TLS Health
- **Function**: `checkTLSCertificate()`
- **Tool**: `openssl s_client -connect tunnel-hostname:443`
- **Code**: `new tls.TLSSocket()` certificate validation
- **Check**: Certificate expiry, chain validity

## Email Processing KPIs

### Emails Retrieved Today
- **Function**: `getEmailCount()`
- **Tool**: KV storage query `await env.EMAIL_STORAGE.get('daily_count')`
- **Database**: `SELECT COUNT(*) FROM emails WHERE date = today()`
- **Log Analysis**: `grep "email retrieved" worker.log | wc -l`

### Processing Success Rate
- **Function**: `calculateSuccessRate()`
- **Formula**: `(successful_retrievals / total_attempts) * 100`
- **Tool**: `await env.METRICS_KV.get('success_rate_24h')`
- **Tracking**: Error counters vs success counters

### Average Processing Time
- **Function**: `getAverageProcessingTime()`
- **Tool**: Performance API `performance.mark()` and `performance.measure()`
- **Storage**: Time series data in KV namespace
- **Calculation**: Total processing time / number of emails

### Queue Length
- **Function**: `getQueueLength()`
- **Tool**: `await env.EMAIL_QUEUE.list()` 
- **Counter**: Pending items in processing queue
- **Real-time**: WebSocket connection to queue status

### Error Rate
- **Function**: `getErrorRate()`
- **Tool**: Error logging and aggregation
- **Formula**: `errors_per_hour = errors_count / hours`
- **Alert**: Trigger when > threshold

## Performance Metrics

### CPU Usage
- **Function**: `getBridgeCPU()`
- **Tool**: `top -p $(pgrep bridge) -n1 | awk '/bridge/ {print $9}'`
- **Code**: `process.cpuUsage()` for Node.js processes
- **System**: `iostat`, `htop`, Activity Monitor

### Memory Usage
- **Function**: `getBridgeMemory()`
- **Tool**: `ps -p $(pgrep bridge) -o %mem,rss,vsz`
- **Code**: `process.memoryUsage()` for Node.js
- **Units**: Convert to MB/GB for display

### Disk I/O
- **Function**: `getDiskIO()`
- **Tool**: `iotop -p $(pgrep bridge)` or `iostat -x 1`
- **Metrics**: Read/write bytes per second
- **Path**: Monitor `/tmp`, bridge cache directories

### Network Throughput
- **Function**: `getNetworkStats()`
- **Tool**: `iftop`, `nload`, or `netlimiter`
- **Code**: Monitor socket connections bandwidth
- **Metrics**: Bytes in/out per second

### Response Time
- **Function**: `measureAPILatency()`
- **Tool**: `curl -w "@curl-format.txt" endpoint`
- **Code**: `const start = Date.now(); await fetch(); const latency = Date.now() - start`
- **Target**: < 200ms for health endpoints

## Workflow Operational KPIs

### Workflow Health
- **Function**: `checkWorkerHealth()`
- **Tool**: Cloudflare API `GET /accounts/:id/workers/scripts/:name`
- **Endpoint**: `https://worker.domain.com/health`
- **Status Codes**: 200 = healthy, 500+ = error

### Last Execution
- **Function**: `getLastExecution()`
- **Tool**: `await env.EXECUTION_LOG.get('last_run_timestamp')`
- **Cron Log**: Cloudflare dashboard cron trigger logs
- **Format**: ISO timestamp with timezone

### Cron Trigger Status
- **Function**: `checkCronStatus()`
- **Tool**: Cloudflare API cron trigger endpoint
- **Dashboard**: Workers & Pages → Triggers
- **Validation**: Next scheduled execution time

### KV Namespace Health
- **Function**: `testKVAccess()`
- **Tool**: `await env.NAMESPACE.put('test', 'value'); await env.NAMESPACE.get('test')`
- **Metrics**: Read/write latency, error rates
- **Quotas**: Check storage usage limits

### Environment Variables
- **Function**: `validateEnvVars()`
- **Tool**: `Object.keys(env).filter(key => key.startsWith('REQUIRED_'))`
- **Check**: Required variables present and non-empty
- **Security**: Mask sensitive values in logs

## Error & Alert Metrics

### Critical Errors
- **Function**: `getCriticalErrors()`
- **Tool**: `grep -i "critical\|fatal\|error" logs/* | tail -100`
- **Code**: `console.error()` with error level categorization
- **Alert**: Immediate notification for critical failures

### Warning Count
- **Function**: `getWarningCount()`
- **Tool**: Log aggregation with warning level filter
- **Pattern**: `WARN`, `WARNING`, log level 2
- **Time Window**: Rolling 24-hour window

### Authentication Failures
- **Function**: `getAuthFailures()`
- **Tool**: `grep "auth.*fail\|login.*fail" bridge.log`
- **Pattern**: HTTP 401, 403 responses
- **Threshold**: > 3 failures in 10 minutes

### Connection Timeouts
- **Function**: `getTimeoutCount()`
- **Tool**: `grep -i "timeout\|connection.*closed" logs/*`
- **Code**: Network timeout exception handling
- **Pattern**: ETIMEDOUT, ECONNRESET errors

### Data Corruption Events
- **Function**: `checkDataIntegrity()`
- **Tool**: Email checksum validation
- **Code**: Message hash comparison
- **Alert**: Immediate notification for corruption

## Business Metrics

### Email Volume
- **Function**: `getEmailVolume()`
- **Tool**: Daily/hourly email count aggregation
- **Database**: Time-series data storage
- **Chart**: Volume trends over time

### Attachment Processing
- **Function**: `getAttachmentStats()`
- **Tool**: File download and processing counters
- **Metrics**: Files processed, total size, types
- **Storage**: Attachment metadata tracking

### Categorization Accuracy
- **Function**: `getCategoryAccuracy()`
- **Tool**: ML model confidence scores
- **Validation**: Manual review sampling
- **Feedback Loop**: User corrections tracking

### Duplicate Detection
- **Function**: `getDuplicateRate()`
- **Tool**: Message ID and hash comparison
- **Algorithm**: Content similarity detection
- **Prevention**: Deduplication effectiveness rate

### Storage Efficiency
- **Function**: `getStorageEfficiency()`
- **Tool**: Compression ratio calculation
- **Metrics**: Original size vs stored size
- **Optimization**: Deduplication savings

## Availability & Reliability

### System Uptime
- **Function**: `getSystemUptime()`
- **Tool**: `uptime`, system boot time
- **Calculation**: Current time - last restart time
- **Target**: 99.9% availability SLA

### MTTR (Mean Time to Repair)
- **Function**: `calculateMTTR()`
- **Tool**: Incident tracking timestamps
- **Formula**: Total downtime / number of incidents
- **Tracking**: Issue creation to resolution time

### MTBF (Mean Time Between Failures)
- **Function**: `calculateMTBF()`
- **Tool**: Failure event logging
- **Formula**: Operating time / number of failures
- **Trend**: Improving reliability over time

### Backup Success Rate
- **Function**: `getBackupSuccess()`
- **Tool**: Backup script exit codes
- **Validation**: Backup file integrity checks
- **Schedule**: Daily/weekly backup verification

### Disaster Recovery Readiness
- **Function**: `checkDRReadiness()`
- **Tool**: DR script validation tests
- **Metrics**: Recovery time objectives (RTO)
- **Testing**: Periodic DR drills

## Cost & Resource Optimization

### Cloudflare Worker Invocations
- **Function**: `getWorkerInvocations()`
- **Tool**: Cloudflare Analytics API
- **Endpoint**: `/analytics/dashboard/zones/:zone/http-requests-1h`
- **Billing**: Track against monthly quotas

### Data Transfer Costs
- **Function**: `getDataTransferCosts()`
- **Tool**: Cloudflare bandwidth usage API
- **Calculation**: Bytes transferred × rate
- **Optimization**: Compression, caching strategies

### Storage Costs
- **Function**: `getStorageCosts()`
- **Tool**: KV namespace usage API
- **Metrics**: Total keys, total size
- **Cleanup**: Automated data retention policies

### Compute Time
- **Function**: `getComputeTime()`
- **Tool**: Worker CPU time tracking
- **Metrics**: Execution duration per invocation
- **Optimization**: Code efficiency improvements

### Resource Utilization
- **Function**: `getResourceUtilization()`
- **Tool**: Multi-metric aggregation dashboard
- **Calculation**: Used resources / allocated resources
- **Target**: 70-80% utilization efficiency

## Security & Compliance KPIs

### TLS Certificate Validity
- **Function**: `checkTLSValidity()`
- **Tool**: `openssl x509 -in cert.pem -text -noout`
- **Code**: Certificate expiry date validation
- **Alert**: 30 days before expiration

### Token Refresh Success
- **Function**: `getTokenRefreshRate()`
- **Tool**: OAuth token refresh logging
- **Pattern**: Successful vs failed refresh attempts
- **Monitoring**: Token expiry predictions

### Access Log Integrity
- **Function**: `validateAccessLogs()`
- **Tool**: Log tampering detection
- **Hash**: SHA-256 log file checksums
- **Audit**: Cryptographic log integrity

### Data Encryption Status
- **Function**: `checkEncryptionStatus()`
- **Tool**: TLS connection validation
- **Code**: Crypto.subtle API verification
- **Standard**: AES-256, TLS 1.3 compliance

### Compliance Score
- **Function**: `getComplianceScore()`
- **Tool**: Automated compliance checking
- **Framework**: GDPR, SOX, ISO 27001 requirements
- **Reporting**: Compliance dashboard metrics