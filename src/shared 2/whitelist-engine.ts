export interface WhitelistRule {
  id: string;
  type: 'DOMAIN' | 'EMAIL' | 'SUBJECT' | 'KEYWORD';
  value: string;
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'LEGAL' | 'COURT' | 'GOVERNMENT' | 'NOTIFICATION' | 'SPAM';
  action: 'ALLOW' | 'PRIORITY' | 'BLOCK';
  description: string;
}

export const DEFAULT_WHITELIST_RULES: WhitelistRule[] = [
  // Legal institutions
  {
    id: 'hk-law',
    type: 'DOMAIN',
    value: 'hklaw.eu',
    priority: 'URGENT',
    category: 'LEGAL',
    action: 'PRIORITY',
    description: 'HK Law - Primary legal counsel'
  },
  {
    id: 'legis-chambers',
    type: 'DOMAIN', 
    value: 'legischambers.com',
    priority: 'HIGH',
    category: 'LEGAL',
    action: 'PRIORITY',
    description: 'Legis Chambers - Legal representation'
  },
  
  // Courts
  {
    id: 'hmcts',
    type: 'DOMAIN',
    value: 'hmcts.gov.uk',
    priority: 'URGENT',
    category: 'COURT',
    action: 'PRIORITY',
    description: 'HM Courts & Tribunals Service'
  },
  {
    id: 'court-service',
    type: 'DOMAIN',
    value: 'courtservice.gov.uk',
    priority: 'URGENT',
    category: 'COURT',
    action: 'PRIORITY',
    description: 'Court Service'
  },
  
  // Government
  {
    id: 'gov-uk',
    type: 'DOMAIN',
    value: 'gov.uk',
    priority: 'HIGH',
    category: 'GOVERNMENT',
    action: 'ALLOW',
    description: 'UK Government communications'
  },
  
  // Legal keywords (urgent)
  {
    id: 'urgent-hearing',
    type: 'SUBJECT',
    value: 'hearing',
    priority: 'URGENT',
    category: 'COURT',
    action: 'PRIORITY',
    description: 'Court hearing notifications'
  },
  {
    id: 'urgent-judgment',
    type: 'SUBJECT',
    value: 'judgment',
    priority: 'URGENT',
    category: 'COURT',
    action: 'PRIORITY',
    description: 'Court judgments'
  },
  {
    id: 'urgent-deadline',
    type: 'SUBJECT',
    value: 'deadline',
    priority: 'URGENT',
    category: 'LEGAL',
    action: 'PRIORITY',
    description: 'Legal deadlines'
  },
  
  // Block spam
  {
    id: 'unsubscribe',
    type: 'SUBJECT',
    value: 'unsubscribe',
    priority: 'LOW',
    category: 'SPAM',
    action: 'BLOCK',
    description: 'Marketing emails'
  },
  {
    id: 'offer',
    type: 'SUBJECT',
    value: 'offer',
    priority: 'LOW',
    category: 'SPAM',
    action: 'BLOCK',
    description: 'Promotional offers'
  },
  
  // Notifications (allow but low priority)
  {
    id: 'noreply',
    type: 'EMAIL',
    value: 'noreply',
    priority: 'LOW',
    category: 'NOTIFICATION',
    action: 'ALLOW',
    description: 'Automated notifications'
  },
  {
    id: 'paypal',
    type: 'DOMAIN',
    value: 'paypal.com',
    priority: 'LOW',
    category: 'NOTIFICATION',
    action: 'ALLOW',
    description: 'PayPal notifications'
  },
  {
    id: 'github',
    type: 'DOMAIN',
    value: 'github.com',
    priority: 'LOW',
    category: 'NOTIFICATION',
    action: 'ALLOW',
    description: 'GitHub notifications'
  },
  {
    id: 'cloudflare',
    type: 'DOMAIN',
    value: 'cloudflare.com',
    priority: 'LOW',
    category: 'NOTIFICATION',
    action: 'ALLOW',
    description: 'Cloudflare alerts'
  }
];

export interface EmailClassification {
  matched: boolean;
  rule?: WhitelistRule;
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'LEGAL' | 'COURT' | 'GOVERNMENT' | 'NOTIFICATION' | 'SPAM';
  action: 'ALLOW' | 'PRIORITY' | 'BLOCK';
  score: number;
}

export class WhitelistEngine {
  private rules: WhitelistRule[];
  
  constructor(customRules: WhitelistRule[] = []) {
    this.rules = [...DEFAULT_WHITELIST_RULES, ...customRules];
  }
  
  classify(email: any): EmailClassification {
    const subject = (email.subject || '').toLowerCase();
    const from = (email.from || '').toLowerCase();
    const body = (email.body || '').toLowerCase();
    
    // Check rules in priority order
    const priorityOrder = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as const;
    
    for (const priorityLevel of priorityOrder) {
      const priorityRules = this.rules.filter(r => r.priority === priorityLevel);
      
      for (const rule of priorityRules) {
        if (this.matchesRule(rule, { subject, from, body })) {
          return {
            matched: true,
            rule,
            priority: rule.priority,
            category: rule.category,
            action: rule.action,
            score: this.calculateScore(rule, email)
          };
        }
      }
    }
    
    // Default classification for unmatched emails
    return {
      matched: false,
      priority: 'MEDIUM',
      category: 'NOTIFICATION',
      action: 'ALLOW',
      score: 10
    };
  }
  
  private matchesRule(rule: WhitelistRule, email: { subject: string; from: string; body: string }): boolean {
    const value = rule.value.toLowerCase();
    
    switch (rule.type) {
      case 'DOMAIN':
        return email.from.includes(value);
        
      case 'EMAIL':
        return email.from.includes(value);
        
      case 'SUBJECT':
        return email.subject.includes(value);
        
      case 'KEYWORD':
        return email.subject.includes(value) || 
               email.body.includes(value) ||
               email.from.includes(value);
               
      default:
        return false;
    }
  }
  
  private calculateScore(rule: WhitelistRule, email: any): number {
    let score = 0;
    
    // Base score by priority
    switch (rule.priority) {
      case 'URGENT': score += 50; break;
      case 'HIGH': score += 30; break;
      case 'MEDIUM': score += 20; break;
      case 'LOW': score += 5; break;
    }
    
    // Boost for category
    switch (rule.category) {
      case 'COURT': score += 25; break;
      case 'LEGAL': score += 20; break;
      case 'GOVERNMENT': score += 15; break;
      case 'NOTIFICATION': score += 5; break;
      case 'SPAM': score -= 10; break;
    }
    
    // Time-based scoring
    const emailDate = new Date(email.date);
    const hoursSinceReceived = (Date.now() - emailDate.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceReceived < 24) {
      score += 20;
    } else if (hoursSinceReceived < 72) {
      score += 10;
    } else if (hoursSinceReceived > 168) { // older than 1 week
      score -= 5;
    }
    
    return Math.max(0, score);
  }
  
  addRule(rule: WhitelistRule): void {
    this.rules.push(rule);
  }
  
  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(r => r.id !== ruleId);
  }
  
  getRules(): WhitelistRule[] {
    return [...this.rules];
  }
}