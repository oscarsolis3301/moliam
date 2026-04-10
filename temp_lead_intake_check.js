import fs from 'fs';

const files = ['functions/api/contact.js', 'functions/api/dashboard.js'];

files.forEach(f => {
  const code = fs.readFileSync(f, 'utf-8');
  console.log(`--- ${f} ---`);
  
  // Check if has try/catch on exported function
  const hasExportCatch = code.match(/export async function.*\n.*{[\s\S]*try\s*\{/);
  console.log(`Has try/catch in export: ${!!hasExportCatch}`);
  
  // Check response format
  const successFormat = code.includes('{ success: true') || code.includes('{success:true');
  console.log(`Uses {success:true} format: ${successFormat}`);
  console.log('');
});
