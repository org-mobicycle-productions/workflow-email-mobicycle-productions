.
├── 1_dashboard
│   ├── index.html
│   ├── kpis.md
│   ├── questions-company-specific.md
│   ├── questions-universal.md
│   ├── styles.css
│   └── tools.md
├── 2_scripts
│   └── bridge-launch.sh
└── 3_workFlowEntrypoints
    ├── index.ts
    ├── project-specific
    │   ├── emails
    │   │   ├── email-distributor-worker 2.ts
    │   │   ├── email-distributor-worker.ts
    │   │   ├── email-processor.ts
    │   │   └── whitelist-worker.ts
    │   ├── kv-instances.md
    │   └── triage
    ├── styles.css
    └── universal
        ├── networking
        │   ├── connectivity
        │   │   ├── imap-client.ts
        │   │   └── smtp-client.ts
        │   └── diagnostics
        │       ├── backend
        │       └── bridge-instance
        └── playwright

14 directories, 16 files