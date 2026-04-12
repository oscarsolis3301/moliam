import { readFileSync, readdirSync } from 'fs';

const apiDir = './functions/api/';
const files = readdirSync(apiDir).filter(f => f.endsWith('.js'));

console.log('=== API Error Handling Status ===\n');

for (const file of files) {
  try {
    const code = readFileSync(apiDir + file, 'utf-8');
    
    // Check if it's an exported function
    const isExported = code.includes('export async function onRequestPost') || 
                      code.startsWith("export async function onRequestGet");
    
    if (!isExported) continue;
    
    // Check try/catch on main export
    const hasTryCatch = code.match(/export.*function.*\{[\s\S]*?try\s*\{/);
    
    // Check response format - should use jsonResp with success:false/error:true
    const hasProperFormat = code.includes('{ success: false,') || 
                           code.includes("{'success': false");
    
    // Check for SQL injection protection (?) parameterized queries
    const hasParamQueries = code.includes('.bind(') || code.match(/\?\s*\)/);
    
    console.log(file + ':');
    console.log('  Export: ' + (isExported ? 'YES' : ''));
    console.log('  Try/Catch: ' + (hasTryCatch ? 'YES' : 'MISSING'));
    console.log('  Proper Error Format: ' + (hasProperFormat ? 'YES' : 'NO'));
    console.log('  Parameterized Queries: ' + (hasParamQueries ? 'YES' : 'check SQL\n'));
    console.log('');
  } catch (e) {
    console.log(file + ': ERROR - ' + e.message + '\n');
  }
}
