#!/usr/bin/env node
/**
 * QMD setup – initializes the local Markdown search index.
 * Run before starting the API (or in CI) to ensure the index exists.
 * Idempotent: safe to run multiple times.
 */
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../../..');
const knowhowDir = resolve(projectRoot, 'markdown-knowhow');

console.log('[qmd-setup] Initializing QMD index...');

// Init creates .qmd/index.sqlite + .qmd/index.yml (idempotent)
execSync('npx qmd init', { cwd: projectRoot, stdio: 'inherit' });

// Add the markdown-knowhow collection (idempotent – ignore "already exists")
try {
  execSync(`npx qmd collection add "${knowhowDir}" --name knowhow`, {
    cwd: projectRoot,
    stdio: 'inherit',
  });
} catch {
  // Collection already exists – that's fine.
}

console.log('[qmd-setup] ✓ QMD index ready.');
