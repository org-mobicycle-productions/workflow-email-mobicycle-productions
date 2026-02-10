/**
 * Email Processor - Checks emails against whitelist and stores in KV
 */

import { getCompleteWhitelist, isEmailWhitelistedDetailed } from './whitelist-worker';

interface Email {
    id: string;
    from: string;
    to: string;
    subject: string;
    body: string;
    date: string;
    messageId: string;
}

// Sample test emails for demonstration
const TEST_EMAILS: Email[] = [
    {
        id: "test-001",
        from: "casework@ico.org.uk",
        to: "rose@mobicycle.ee",
        subject: "Data Protection Complaint Investigation",
        body: "We are investigating your complaint reference ICO-123456...",
        date: new Date().toISOString(),
        messageId: "<test-001@ico.org.uk>"
    },
    {
        id: "test-002", 
        from: "admin@supremecourt.uk",
        to: "rose@mobicycle.ee",
        subject: "Appeal Case Update",
        body: "Regarding your appeal case SC-2024-001...",
        date: new Date().toISOString(),
        messageId: "<test-002@supremecourt.uk>"
    },
    {
        id: "test-003",
        from: "legal@gov.ee", 
        to: "rose@mobicycle.ee",
        subject: "Estonian Legal Matter",
        body: "Reference to legal proceedings in Estonia...",
        date: new Date().toISOString(),
        messageId: "<test-003@gov.ee>"
    },
    {
        id: "test-004",
        from: "spam@example.com",
        to: "rose@mobicycle.ee", 
        subject: "Buy Our Product!!!",
        body: "Amazing deals on products you don't need...",
        date: new Date().toISOString(),
        messageId: "<test-004@example.com>"
    }
];

async function processEmails(emails: Email[]) {
    console.log("🔍 Processing emails against whitelist...\n");
    
    const whitelist = getCompleteWhitelist();
    console.log(`📊 Using whitelist with ${whitelist.addresses.length} entries\n`);
    
    for (const email of emails) {
        console.log(`📧 Processing: ${email.from} -> "${email.subject}"`);
        
        // Check email against whitelist
        const whitelistResult = isEmailWhitelistedDetailed(email.from, whitelist);
        
        if (whitelistResult.allowed) {
            console.log(`   ✅ WHITELISTED`);
            console.log(`   📂 Categories: ${whitelistResult.categories.join(', ')}`);
            console.log(`   🏷️  Legal Type: ${whitelistResult.tags?.legalType.join(', ')}`);
            console.log(`   🌍 Jurisdiction: ${whitelistResult.tags?.jurisdiction.join(', ')}`);
            console.log(`   ⚡ Priority: ${whitelistResult.tags?.priority}`);
            console.log(`   💾 KV Namespaces: ${whitelistResult.tags?.kvNamespace.join(', ')}`);
            
            // Simulate storing in KV namespaces
            if (whitelistResult.tags?.kvNamespace) {
                for (const kvNamespace of whitelistResult.tags.kvNamespace) {
                    console.log(`   📝 Would store in KV: ${kvNamespace}`);
                    
                    // Create email key
                    const emailDate = new Date(email.date);
                    const year = emailDate.getUTCFullYear();
                    const day = emailDate.getUTCDate().toString().padStart(2, '0');
                    const month = (emailDate.getUTCMonth() + 1).toString().padStart(2, '0');
                    const dateStr = `${year}.${day}.${month}`;
                    const hours = emailDate.getUTCHours().toString().padStart(2, '0');
                    const minutes = emailDate.getUTCMinutes().toString().padStart(2, '0');
                    const seconds = emailDate.getUTCSeconds().toString().padStart(2, '0');
                    const timeStr = `${hours}-${minutes}-${seconds}`;
                    const senderKey = email.from.replace(/[@.]/g, '_');
                    const emailKey = `${dateStr}_${senderKey}_${timeStr}`;
                    
                    console.log(`   🔑 Key: ${emailKey}`);
                    
                    // Email data that would be stored
                    const emailData = {
                        originalId: email.id,
                        key: emailKey,
                        from: email.from,
                        to: email.to,
                        subject: email.subject,
                        body: email.body.substring(0, 200) + "...", // Truncate for display
                        date: email.date,
                        messageId: email.messageId,
                        whitelistMatch: {
                            pattern: whitelistResult.matchedPattern,
                            categories: whitelistResult.categories,
                            tags: whitelistResult.tags
                        },
                        storedAt: new Date().toISOString()
                    };
                    
                    console.log(`   📄 Data: ${JSON.stringify(emailData, null, 2)}`);
                }
            }
        } else {
            console.log(`   ❌ BLOCKED - Not on whitelist`);
            console.log(`   🗑️  Email would be discarded or quarantined`);
        }
        
        console.log(); // Empty line for spacing
    }
}

// Simulate the workflow process
async function simulateWorkflow() {
    console.log("🚀 Starting Email Processing Simulation\n");
    console.log("=" * 50);
    
    // Step 1: Connect to IMAP and fetch emails
    console.log("📥 Step 1: Fetching emails from IMAP...");
    console.log(`   📊 Found ${TEST_EMAILS.length} emails to process\n`);
    
    // Step 2: Process each email against whitelist
    console.log("🔍 Step 2: Processing emails against whitelist...");
    await processEmails(TEST_EMAILS);
    
    // Step 3: Summary
    const whitelistedEmails = TEST_EMAILS.filter(email => {
        const whitelist = getCompleteWhitelist();
        return isEmailWhitelistedDetailed(email.from, whitelist).allowed;
    });
    
    console.log("📊 Summary:");
    console.log(`   📧 Total emails processed: ${TEST_EMAILS.length}`);
    console.log(`   ✅ Emails whitelisted: ${whitelistedEmails.length}`);
    console.log(`   ❌ Emails blocked: ${TEST_EMAILS.length - whitelistedEmails.length}`);
    
    console.log("\n🎉 Email processing simulation complete!");
}

// Run simulation if executed directly
if (require.main === module) {
    simulateWorkflow().catch(console.error);
}

export { processEmails, simulateWorkflow };