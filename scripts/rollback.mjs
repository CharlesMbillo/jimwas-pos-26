import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const ref = process.env.ROLLBACK_REF || process.argv[2];
if (!ref || !/^[A-Za-z0-9._\/-]+$/.test(ref)) { console.error('A safe Git tag or ref is required via ROLLBACK_REF'); process.exit(1); }
const root = resolve(import.meta.dirname, '..');
const run = (args) => execFileSync('git', args, { cwd: root, stdio: 'inherit' });
run(['fetch', '--tags', '--force']);
run(['show-ref', '--verify', '--quiet', `refs/tags/${ref}`]);
run(['checkout', '--detach', ref]);
console.log(`Rollback source selected: ${ref}`);
