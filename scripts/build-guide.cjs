// Rebuild the offline HTML guide: node docs/scripts/build-guide.cjs
// Uses marked and sharp from the current app dependency tree. No network requests.
const fs = require('node:fs');
const path = require('node:path');
const { marked } = require('marked');
const sharp = require('sharp');

async function buildGuide() {
const docsRoot = path.resolve(__dirname, '..');
const imageSizes = new Map();
for (const filename of fs.readdirSync(path.join(docsRoot, 'screenshots'))) {
  const relativePath = `screenshots/${filename}`;
  const metadata = await sharp(path.join(docsRoot, relativePath)).metadata();
  imageSizes.set(relativePath, { width: metadata.width, height: metadata.height });
}
const files = ['INDEX.md', ...fs.readdirSync(docsRoot).filter((f) => /^\d\d-.*\.md$/.test(f)).sort()];
const escapeHtml = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const sectionId = (file) => file === 'INDEX.md' ? 'start' : path.basename(file, '.md');
const titles = new Map(files.map((file) => [file, fs.readFileSync(path.join(docsRoot, file), 'utf8').match(/^# (.+)$/m)[1]]));
const nav = files.map((file) => `<a href="#${sectionId(file)}">${escapeHtml(titles.get(file).replace('Svara AI — ', ''))}</a>`).join('\n');

const articles = files.map((file) => {
  let html = marked.parse(fs.readFileSync(path.join(docsRoot, file), 'utf8'), { gfm: true });
  const codeAnchor = `${sectionId(file)}-code`;
  html = html.replace(/<(h[23])>Code examples and source locations<\/h[23]>/, `<$1 id="${codeAnchor}">Code examples and source locations</$1>`);
  html = html.replace('</h1>', `</h1><p class="code-jump"><a href="#${codeAnchor}">Code examples and source files ↓</a></p>`);
  html = html.replaceAll('href="final-release.html"', 'href="#start"');
  html = html.replace(/href="([^"#]+\.md)(?:#[^"]*)?"/g, (match, name) => files.includes(name) ? `href="#${sectionId(name)}"` : match);
  html = html.replace(/<img src="(screenshots\/[^"<>]+)" alt="([^"]*)"[^>]*>/g, (match, imagePath, alt) => {
    const bytes = fs.readFileSync(path.join(docsRoot, imagePath));
    const dimensions = imageSizes.get(imagePath);
    return `<figure><img src="data:image/jpeg;base64,${bytes.toString('base64')}" alt="${alt}" width="${dimensions.width}" height="${dimensions.height}" loading="lazy"><figcaption>${alt}</figcaption></figure>`;
  });
  html = html.replace(/<table>/g, '<div class="table-scroll"><table>').replace(/<\/table>/g, '</table></div>');
  html = html.replace(/<pre><code class="language-([a-zA-Z0-9_-]+)">/g, '<div class="code-block"><div class="code-label">$1</div><pre><code class="language-$1">');
  html = html.replaceAll('</code></pre>', '</code></pre></div>');
  return `<article id="${sectionId(file)}">${html}<p class="back"><a href="#start">Back to guide index ↑</a></p></article>`;
}).join('\n');

const output = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Svara AI | Final Release Guide</title>
<style>
:root{color-scheme:light;--ink:#19212d;--muted:#5d6675;--line:#e3e7ed;--orange:#e94f00;--nav:#141c29}
*{box-sizing:border-box}body{margin:0;background:#f4f6f9;color:var(--ink);font:16px/1.7 system-ui,-apple-system,'Segoe UI',sans-serif}
aside{position:fixed;inset:0 auto 0 0;width:288px;background:var(--nav);color:#fff;padding:30px 20px;overflow:auto}aside .brand{display:flex;align-items:center;gap:12px;margin:0 8px 23px}.mark{display:grid;place-items:center;background:#ff5a0b;border-radius:13px;width:44px;height:44px;font-size:28px;font-weight:750}.brand strong{display:block;font-size:19px}.brand small{color:#bec8d8;font-size:12px}
nav a{display:block;color:#dce3ed;text-decoration:none;padding:10px 12px;border-radius:7px;font-size:13px;line-height:1.5;margin-bottom:3px}nav a:hover,nav a:focus{background:#293449;color:#fff}aside .edition{font-size:12px;color:#a5b2c6;margin:24px 12px}
main{margin-left:288px;padding:34px clamp(20px,4vw,72px) 70px;max-width:1650px}.cover{display:flex;align-items:center;justify-content:space-between;gap:20px;color:var(--muted);font-size:13px;margin-bottom:20px}.pill{padding:5px 11px;border:1px solid #f5c8b0;border-radius:99px;color:#a73a00;background:#fff2ea}button{background:#fff;border:1px solid var(--line);padding:9px 15px;border-radius:7px;font:inherit;font-size:13px;cursor:pointer}
article{background:#fff;border:1px solid var(--line);border-radius:14px;padding:clamp(22px,3.5vw,56px);margin-bottom:30px;scroll-margin-top:20px;box-shadow:0 4px 18px #20304b04}h1{font-size:clamp(27px,3vw,38px);line-height:1.22;letter-spacing:-.035em;margin:0 0 22px}h2{font-size:23px;line-height:1.35;letter-spacing:-.02em;margin:43px 0 15px;padding-top:18px;border-top:1px solid var(--line)}h3{font-size:19px;margin-top:28px}p{margin:14px 0}a{color:#b73e00;text-underline-offset:3px}li{margin:7px 0}li p{margin:5px 0}strong{font-weight:650}code{font-family:Consolas,'Courier New',monospace;font-size:.87em;background:#f0f3f7;border-radius:4px;padding:2px 5px;overflow-wrap:anywhere}pre{background:#172131;color:#e5edf6;border-radius:9px;overflow:auto;padding:20px;line-height:1.65;margin:20px 0}pre code{background:none;color:inherit;padding:0;font-size:13px;white-space:pre;overflow-wrap:normal}
.code-block{margin:20px 0;border:1px solid #2d3b50;border-radius:9px;overflow:hidden;background:#172131}.code-label{padding:7px 16px;background:#223047;color:#c7d6e9;font-size:11px;letter-spacing:1px;text-transform:uppercase}.code-block pre{margin:0;border-radius:0}
figure{margin:24px 0;border:1px solid var(--line);border-radius:9px;overflow:hidden;background:#fafbfd}figure img{display:block;width:100%;height:auto}figcaption{padding:10px 15px;color:var(--muted);border-top:1px solid var(--line);font-size:12px}.image-link{display:block}table{border-collapse:collapse;width:100%;font-size:14px;line-height:1.6}th,td{padding:12px 14px;border:1px solid var(--line);text-align:left;vertical-align:top}th{background:#f3f5f8;font-weight:650}tr:nth-child(even) td{background:#fcfdff}.table-scroll{overflow-x:auto;margin:20px 0}td code{font-size:12px}blockquote{margin:20px 0;border-left:4px solid var(--orange);padding:1px 18px;background:#fff5ef}.back{font-size:13px;margin-top:35px;padding-top:18px;border-top:1px solid var(--line)}input[type=checkbox]{accent-color:var(--orange)}
@media(max-width:950px){aside{position:relative;width:auto;padding:20px}aside .brand{margin-bottom:12px}nav{display:flex;overflow-x:auto;gap:6px}nav a{min-width:160px}aside .edition{margin:12px}main{margin:0;padding:20px}article{padding:24px}.cover{flex-wrap:wrap}}
@media print{html{scroll-behavior:auto}body{background:#fff;font-size:10pt;line-height:1.5}aside,.cover,.back{display:none}main{margin:0;padding:0;max-width:none}article{border:0;box-shadow:none;border-radius:0;padding:0;margin:0;break-before:page}article:first-of-type{break-before:auto}h1{font-size:25pt}h2{font-size:15pt;break-after:avoid;margin-top:24px}p,li{orphans:3;widows:3}figure,pre,tr{break-inside:avoid}figure{max-width:100%;margin:14px 0}figure img{max-height:180mm;object-fit:contain}a{color:inherit}pre{white-space:pre-wrap}table{font-size:9pt}@page{size:A4;margin:18mm}}
</style></head><body><aside><div class="brand"><span class="mark">S</span><div><strong>Svara AI</strong><small>Final Release · SutraCore</small></div></div><nav aria-label="Guide chapters">${nav}</nav><p class="edition">31 October 2026<br>Application version 0.1.0<br>Offline illustrated edition</p></aside><main><div class="cover"><span class="pill">Final Release documentation</span><span>${imageSizes.size} captured screenshots · ${files.length - 1} chapters</span><button type="button" onclick="window.print()">Print / Save as PDF</button></div>${articles}</main></body></html>`;
const target = path.join(docsRoot, 'final-release.html');
fs.writeFileSync(target, output);
console.log(`Built ${target} (${(Buffer.byteLength(output) / 1024 / 1024).toFixed(2)} MiB; screenshots embedded).`);
}
buildGuide().catch((error) => { console.error(error); process.exitCode = 1; });
