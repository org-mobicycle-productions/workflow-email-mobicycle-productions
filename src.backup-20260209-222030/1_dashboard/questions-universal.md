# MobiCycle Email Workflow - Diagnostic Questions

## Infrastructure Status
1. Is ProtonMail Bridge connected?
2. What's the tunnel URL?
3. Is it idle waiting for emails?
4. Does it have a cron trigger or is it event-driven?
5. What errors is it encountering?
6. Where is the workflow source code located?
7. Is it connected to ProtonMail Bridge?
8. What bindings and environment variables are configured?
9. Where should I look to see the workflow logs and status?

## Bridge Health
10. Is the Bridge process running?
11. What port is it listening on?
12. Is cloudflared running?
13. What's the cloudflared config?
14. When was Bridge last restarted?
15. Has process crashed/restarted unexpectedly?
16. CPU/memory usage abnormal?
17. Bridge authenticated with Proton servers?
18. Encrypted session active without re-authentication?
19. Authentication failures logged?
20. Connections being refused or timing out?

## Tunnel Connectivity
21. Has tunnel reconnected unexpectedly?
22. Tunnel reporting degraded connectivity?
23. Ingress rules changed without authorization?
24. DNS records aligned with tunnel hostnames?
25. Packet loss between Cloudflare edge and local endpoint?
26. TLS negotiations completing correctly?

## Email Processing
27. Emails retrieved on schedule?
28. Average polling interval success rate?
29. Retrieval attempts failing?
30. Latency metrics (Proton → Bridge → Script)?
31. Messages complete and uncorrupted?
32. Attachments consistently retrieved?
33. Duplicate downloads occurring?

## Workflow Operations
34. Which step is failing?
35. Should I add cron triggers to all workflows so they automatically poll for emails?
36. Checks all dashboard statuses at once?
37. Triggers all workflows?
38. Shows a combined status view?
39. What should the script do?

## Deployment & Configuration
40. Should I add the same dashboard to other workflows?
41. Should I complete this task or discuss the workflows structure first?
42. Install the local cron (free, requires Mac always on)?
43. Add Cloudflare cron trigger (15¢/month, always running)?
44. Just manually start cloudflared when needed (free, manual)?
45. Should I add this to the cron/auto-start setup?
46. Would you like me to set up email-monitor.js as a persistent service that auto-starts when your Mac boots?

## System Requirements
47. Does your Mac need to wake up for Bridge to work?
48. Is your Mac usually on/sleeping, or completely off?
49. Would you be open to running Bridge on a cloud VM instead?
50. Should I create the iOS Shortcut automation for you?

## Performance & Scaling
51. How can we keep the cron job as low as possible to not trigger any fees?
52. Want me to check if the workflow has finished processing and show you which emails were categorized?
53. Should I update the workflow to separate these steps on the dashboard?
54. Should I update the workflow to track and display all these stages separately on the dashboard?