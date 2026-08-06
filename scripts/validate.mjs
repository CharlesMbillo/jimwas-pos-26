import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const required = ['package.json', 'vite.config.ts', 'supabase', 'supabase/functions'];
const failures = [];
const warnings = [];
const check = (condition, message) => condition ? undefined : failures.push(message);

for (const item of required) check(existsSync(join(root, item)), `Missing required path: ${item}`);
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
for (const script of ['lint', 'typecheck', 'build']) check(Boolean(pkg.scripts?.[script]), `package.json is missing script: ${script}`);
check(pkg.private === true, 'package.json must remain private');

const functionsRoot = join(root, 'supabase/functions');
const functionDirs = existsSync(functionsRoot) ? readdirSync(functionsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !['lib', 'tests'].includes(entry.name)).map((entry) => entry.name) : [];
const duplicates = functionDirs.filter((name, index) => functionDirs.indexOf(name) !== index);
check(duplicates.length === 0, `Duplicate Edge Function names: ${duplicates.join(', ')}`);
for (const name of functionDirs) check(existsSync(join(functionsRoot, name, 'index.ts')), `Missing index.ts for Edge Function: ${name}`);
check(functionDirs.some((name) => name.includes('kcb-stk')), 'KCB STK Edge Function was not discovered');
check(functionDirs.some((name) => name.includes('mpesa')), 'M-Pesa Edge Function was not discovered');

if (!existsSync(join(root, 'supabase/config.toml'))) warnings.push('supabase/config.toml is absent; Supabase CLI checks will be skipped locally.');
if (!process.env.CI) warnings.push('Running outside CI: provider secret checks are intentionally skipped.');

if (failures.length) { console.error(JSON.stringify({ ok: false, failures, warnings }, null, 2)); process.exit(1); }
console.log(JSON.stringify({ ok: true, discoveredFunctions: functionDirs, failures, warnings }, null, 2));
