import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import * as XLSX from 'xlsx';
import { buildTemplateWorkbook } from '../lib/excel.js';

const out = join(process.cwd(), 'server', 'public', 'clutch-template.xlsx');
if (!existsSync(dirname(out))) mkdirSync(dirname(out), { recursive: true });

const wb = buildTemplateWorkbook();
const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
writeFileSync(out, buf);
console.log('Wrote', out);
