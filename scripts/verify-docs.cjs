// Check documentation references using Node.js built-ins only.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const markdown = fs.readdirSync(root).filter((name) => name.endsWith('.md'));
const failures = [];
const usedImages = new Set();
let links = 0;
let codeBlocks = 0;
for (const file of markdown) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  if (!/!\[[^\]]*\]\(screenshots\//.test(source)) failures.push(`${file}: no screenshot attached`);
  if (!/^#{2,3} Code examples and source locations\s*$/m.test(source)) failures.push(`${file}: no code examples section`);
  const fileCodeBlocks = [...source.matchAll(/^```[a-z][a-z0-9_-]*\s*$/gm)].length;
  if (!fileCodeBlocks) failures.push(`${file}: no labelled code block`);
  if ((source.match(/^```/gm) || []).length !== fileCodeBlocks * 2) failures.push(`${file}: unbalanced or unlabelled code fence`);
  codeBlocks += fileCodeBlocks;
  for (const match of source.matchAll(/(!?)\[([^\]]*)\]\(([^)]+)\)/g)) {
    const href = match[3].split('#')[0];
    if (!href || /^(https?:|mailto:|data:)/.test(href)) continue;
    const target = path.resolve(root, decodeURIComponent(href));
    if (!target.startsWith(root + path.sep)) failures.push(`${file}: reference escapes docs: ${href}`);
    else if (!fs.existsSync(target)) failures.push(`${file}: missing ${href}`);
    if (match[1]) usedImages.add(href);
    links++;
  }
}
const templatePath = path.join(root, 'config', '.env.example');
const template = fs.readFileSync(templatePath, 'utf8');
const names = [...template.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]);
if (names.length !== new Set(names).size) failures.push('Environment template has duplicate variable names');
const projectRoot = path.resolve(root, '..');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
const runtimeFiles = [...walk(path.join(projectRoot, 'app')), ...walk(path.join(projectRoot, 'lib')), path.join(projectRoot, 'drizzle.config.ts')].filter((f) => /\.(ts|tsx)$/.test(f));
const referencedNames = new Set(runtimeFiles.flatMap((f) => [...fs.readFileSync(f, 'utf8').matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)].map((m) => m[1])));
for (const name of referencedNames) if (!names.includes(name)) failures.push(`Environment template missing runtime variable: ${name}`);
for (const file of walk(root)) {
  if (!/\.(md|html|cjs|ps1|sql)$/.test(file)) continue;
  const contents = fs.readFileSync(file, 'utf8');
  if (/\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b|\bwhsec_[A-Za-z0-9]{20,}\b|\bre_[A-Za-z0-9]{25,}\b/.test(contents)) failures.push(`Credential-like value detected: ${path.relative(root, file)}`);
}
// When run on the original workspace, compare secret values without printing them.
// This check is optional on a fresh delivery with no real .env configured yet.
const currentEnvPath = path.join(projectRoot, '.env');
if (fs.existsSync(currentEnvPath)) {
  const currentSecrets = fs.readFileSync(currentEnvPath, 'utf8').split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (!match || !/SECRET|PASSWORD|API_KEY|ACCESS_KEY/.test(match[1])) return [];
    const value = match[2].trim().replace(/^['"]|['"]$/g, '');
    return value.length >= 12 ? [value] : [];
  });
  for (const file of walk(root).filter((f) => /\.(md|html|cjs|ps1|sql|example)$/.test(f))) {
    if (currentSecrets.some((secret) => fs.readFileSync(file, 'utf8').includes(secret))) failures.push(`Current environment secret found in ${path.relative(root, file)}`);
  }
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Verified ${markdown.length} documents with ${codeBlocks} code blocks, ${links} local links/image references, ${usedImages.size} unique screenshots, and ${names.length} environment variables.`);
}
