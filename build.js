// Builds the static site into dist/:
//  - renders index.html and one work-<slug>.html per category from content/categories/*.json
//  - converts uploaded JPG/PNG/GIF in works/ to WebP (max 2000px wide, aim for <= 500KB)
//  - copies everything else (css, js, logo, videos, admin) as-is
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const MAX_WIDTH = 2000;
const MAX_BYTES = 500 * 1024;
const CONVERT_EXT = ['.jpg', '.jpeg', '.png', '.gif'];
const STATIC_FILES = ['index.css', 'work.css', 'script.js', 'logo.png'];
const STATIC_DIRS = ['admin'];

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fill = (tpl, vars) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');

// "/works/a.jpg" -> "works/a.webp" (the path the built page should point to)
function mediaPath(p) {
  if (!p) return '';
  p = p.replace(/^\/+/, '');
  const ext = path.extname(p).toLowerCase();
  return CONVERT_EXT.includes(ext) ? p.slice(0, -ext.length) + '.webp' : p;
}

async function toWebp(src, dest) {
  const animated = path.extname(src).toLowerCase() === '.gif';
  const meta = await sharp(src, { animated }).metadata();
  for (const quality of [82, 76, 70, 64, 58, 52]) {
    let img = sharp(src, { animated });
    if (meta.width > MAX_WIDTH) img = img.resize({ width: MAX_WIDTH });
    const buf = await img.webp({ quality, effort: 5 }).toBuffer();
    if (buf.length <= MAX_BYTES || quality === 52) {
      fs.writeFileSync(dest, buf);
      return { quality, kb: Math.round(buf.length / 1024) };
    }
  }
}

async function buildMedia() {
  const srcDir = path.join(ROOT, 'works');
  const outDir = path.join(DIST, 'works');
  fs.mkdirSync(outDir, { recursive: true });
  for (const name of fs.readdirSync(srcDir)) {
    if (name.startsWith('.')) continue;
    const src = path.join(srcDir, name);
    const ext = path.extname(name).toLowerCase();
    if (CONVERT_EXT.includes(ext)) {
      const r = await toWebp(src, path.join(outDir, mediaPath(name)));
      console.log(`  webp  ${name} -> ${mediaPath(name)} (q${r.quality}, ${r.kb}KB)`);
    } else {
      fs.copyFileSync(src, path.join(outDir, name));
    }
  }
}

function embedUrl(url) {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return url;
}

function renderWork(w, i) {
  const lazy = i === 0 ? '' : ' loading="lazy" decoding="async"';
  let media;
  if (w.type === 'video') {
    media = `<video src="${esc(mediaPath(w.video))}" autoplay muted loop playsinline preload="${i === 0 ? 'auto' : 'metadata'}"></video>`;
  } else if (w.type === 'embed') {
    media = `<div class="stack-embed"><iframe src="${esc(embedUrl(w.url))}" title="${esc(w.alt)}" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
  } else {
    media = `<img${lazy} src="${esc(mediaPath(w.image))}" alt="${esc(w.alt)}">`;
  }
  const caption = w.caption ? `\n                <p class="stack-caption">${esc(w.caption).replace(/\n/g, '<br>')}</p>` : '';
  return `            <div class="stack-item">\n                ${media}${caption}\n            </div>`;
}

function loadCategories() {
  const dir = path.join(ROOT, 'content', 'categories');
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
    .filter(c => !c.hidden)
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}

function buildPages(cats) {
  const page = c => `work-${c.slug}.html`;
  const indexTpl = fs.readFileSync(path.join(ROOT, 'templates', 'index.html'), 'utf8');
  const workTpl = fs.readFileSync(path.join(ROOT, 'templates', 'work.html'), 'utf8');

  const indexNav = cats.map(c => `          <li><a href="${page(c)}">${esc(c.name)}</a></li>`).join('\n');
  const workNav = cats.map(c => `                    <li><a href="${page(c)}">${esc(c.fullName)}</a></li>`).join('\n');
  const grid = cats.map(c => `      <a href="${page(c)}" class="work-item reveal">
        <div class="work-thumb">
          <img loading="lazy" decoding="async" src="${esc(mediaPath(c.cover))}" alt="${esc(c.name)}">
        </div>
        <div class="work-info">
          <h3>${esc(c.name)}</h3>
        </div>
      </a>`).join('\n\n');
  fs.writeFileSync(path.join(DIST, 'index.html'), fill(indexTpl, { nav: indexNav, worksGrid: grid }));

  cats.forEach((c, idx) => {
    // "Other Works": the next 4 categories after this one, wrapping around
    const others = [];
    for (let k = 1; k < cats.length && others.length < 4; k++) others.push(cats[(idx + k) % cats.length]);
    const related = others.map(o => `            <a href="${page(o)}" class="related-item">
                <div class="related-thumb"><img loading="lazy" decoding="async" src="${esc(mediaPath(o.cover))}" alt=""></div>
                <div class="related-name">${esc(o.fullName)}</div>
                <div class="related-tag">${esc(o.en)}</div>
            </a>`).join('\n');
    const works = (c.works || []).length
      ? c.works.map(renderWork).join('\n\n')
      : '            <p class="stack-empty">作品準備中，敬請期待。</p>';
    fs.writeFileSync(path.join(DIST, page(c)), fill(workTpl, {
      title: `${esc(c.fullName)} — Lemon Portfolio`,
      nav: workNav, en: esc(c.en), pageTitle: esc(c.pageTitle), works, related,
    }));
    console.log(`  page  ${page(c)} (${(c.works || []).length} works)`);
  });
}

(async () => {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST);
  for (const f of STATIC_FILES) fs.copyFileSync(path.join(ROOT, f), path.join(DIST, f));
  for (const d of STATIC_DIRS) fs.cpSync(path.join(ROOT, d), path.join(DIST, d), { recursive: true });
  console.log('Media:');
  await buildMedia();
  console.log('Pages:');
  buildPages(loadCategories());
  console.log('Done -> dist/');
})().catch(err => { console.error(err); process.exit(1); });
