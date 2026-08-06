import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const functionsRoot = join(root, 'supabase/functions');
const dryRun = process.argv.includes('--dry-run');
const projectRef = process.env.SUPABASE_PROJECT_REF;
if (!projectRef && !dryRun) { console.error('SUPABASE_PROJECT_REF is required'); process.exit(1); }
const functions = readdirSync(functionsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !['lib', 'tests'].includes(entry.name) && existsSync(join(functionsRoot, entry.name, 'index.ts'))).map((entry) => entry.name).sort();
const report = { ok: true, projectRef: projectRef || 'dry-run', functions, migrations: false, dryRun };
const run = (command, args) => { if (dryRun) return; execFileSync(command, args, { cwd: root, stdio: 'inherit', env: process.env }); };
run('supabase', ['link', '--project-ref', projectRef]);
if (existsSync(join(root, 'supabase/migrations'))) { run('supabase', ['db', 'push']); report.migrations = true; }
for (const name of functions) run('supabase', ['functions', 'deploy', name, '--project-ref', projectRef]);
const reportPath = join(root, 'deployment-report.json');
writeFileSync(reportPath, JSON.stringify(report, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [
    '## Deployment report',
    '',
    `- Target: ${report.projectRef}`,
    `- Migrations: ${report.migrations ? 'applied' : 'dry-run'}`,
    `- Functions deployed: ${report.functions.length}`,
    '',
    ...report.functions.map((name) => `- ${name}`),
    '',
  ];
  writeFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\\n'));
}
console.log(JSON.stringify(report, null, 2));
