#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const apiDir = process.argv[2] || './moliam/functions/api';

function auditForJSDocAndErrors() {
    const files = fs.readdirSync(apiDir).filter(f => f.endsWith('.js') && !f.startsWith('.') && !['lib', 'node_modules'].some(d => path.basename(apiDir).includes(d)));

    const results = [];
    
    for (const file of files) {
        const filePath = path.join(apiDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check if file has top-level JSDoc comment before first exported function
        const exportMatch = content.match(/\/\*\*([\s\S]*?)\*\/\s+export/);
        
        if (!exportMatch && !path.basename(apiDir).includes('lib')) {
            results.push({ file, issues: ['Missing top-level JSDoc'] });
        } else if (exportMatch) {
            const jsdoc = exportMatch[1];
            if (!jsdoc.includes('@param') && !jsdoc.includes('@returns')) {
                results.push({ file, issues: ['JSDoc missing @param or @returns tags'] });
            }
        }
        
        // Check for SQL injection risks - look for unparameterized queries
        const sqlPattern = /\.prepare\([^;]+\)/g;
        const matches = content.match(sqlPattern) || [];
        
        for (const match of matches) {
            if (!match.includes('?')) {
                results.push({ file, issues: ['SQL query may not be parameterized'] });
            }
        }
        
        // Check for dead code patterns
        if (content.match(/\/\/ TODO[^ ]/i)) {
            results.push({ file, issues: ['Dead code: uncommented TODO comments'] });
        }
        
        if (content.match(/\s*\/\/.*[A-Z]{5,}/)) {
            results.push({ file, issues: ['Possible dead code block: long commented strings'] });
        }
    }

    return results;
}

const issues = auditForJSDocAndErrors();

if (issues.length === 0) {
    console.log('✅ All files properly documented and sanitized!');
    process.exit(0);
} else {
    console.log(`Found ${issues.length} files with potential issues:`);
    for (const issue of issues) {
        console.log(`\n${issue.file}:`);
        issue.issues.forEach(msg => console.log(`  - ${msg}`));
    }
    process.exit(1);
}
