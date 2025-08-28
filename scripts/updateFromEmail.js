#!/usr/bin/env node

/**
 * Update FROM Email Address Script
 * 
 * This script updates all FROM email addresses in the email service
 * to use the new FROM_EMAIL configuration.
 */

const fs = require('fs');
const path = require('path');

const emailServicePath = path.join(__dirname, '../src/services/emailService.js');

console.log('📧 Updating FROM email addresses...\n');

// Read the email service file
let content = fs.readFileSync(emailServicePath, 'utf8');

// Count how many instances we need to replace
const oldPattern = /from: `"\${process\.env\.EMAIL_FROM_NAME \|\| '[^']*'}" <\${process\.env\.ZEPTO_MAIL_USER}>`/g;
const matches = content.match(oldPattern);

console.log(`Found ${matches ? matches.length : 0} instances to update`);

// Replace all instances
const newContent = content.replace(
    /from: `"\${process\.env\.EMAIL_FROM_NAME \|\| '[^']*'}" <\${process\.env\.ZEPTO_MAIL_USER}>`/g,
    'from: `"${process.env.EMAIL_FROM_NAME || \'Student Delivery\'}" <${this.fromEmail}>`'
);

// Write the updated content back
fs.writeFileSync(emailServicePath, newContent);

console.log('✅ FROM email addresses updated successfully!');
console.log('\n📝 Next steps:');
console.log('1. Add FROM_EMAIL=noreply@greep.io to your .env file');
console.log('2. Test the email configuration with: npm run test:email');
console.log('3. Restart your server to apply changes');
