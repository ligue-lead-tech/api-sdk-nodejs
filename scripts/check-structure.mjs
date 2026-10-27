// Checks the layout the SDK is organized by: under src/, every file is PascalCase and, outside
// Types/ and the index.ts barrels, declares exactly one exported class named after the file.
// ESLint's max-classes-per-file covers "at most one"; this covers the name and "at least one".
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

const root = new URL('../src', import.meta.url).pathname;
const problems = [];

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);

    if (statSync(path).isDirectory()) {
      if (!/^[A-Z][A-Za-z0-9]*$/.test(entry)) {
        problems.push(`${relative(root, path)}: folders are PascalCase`);
      }

      walk(path);
      continue;
    }

    check(path);
  }
}

function check(path) {
  const file = relative(root, path);
  const name = basename(path, '.ts');

  if (!path.endsWith('.ts') || name === 'index') {
    return;
  }

  if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) {
    problems.push(`${file}: files are PascalCase`);
    return;
  }

  if (file.startsWith('Types/')) {
    return;
  }

  const classes = [...readFileSync(path, 'utf8').matchAll(/^export (?:abstract )?class (\w+)/gm)].map((match) => match[1]);

  if (classes.length !== 1 || classes[0] !== name) {
    problems.push(`${file}: must export exactly one class, named ${name} (found ${classes.join(', ') || 'none'})`);
  }
}

walk(root);

if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}

console.log('structure ok');
