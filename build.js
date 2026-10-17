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
const STATIC_FILES = ['index.css', 'work.css', 'custom.css', 'script.js', 'custom.js', 'lightbox.js', 'logo.png'];
const STATIC_DIRS = ['admin'];

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fill = (tpl, vars) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');

// Where each converted upload ends up: "works/a.jpg" -> "works/a.webp" (or "works/a-upload.webp"
// when an existing a.webp, or another a.png/a.gif, would otherwise be overwritten).
const outMap = new Map();

// "/works/a.jpg" -> the path the built page should point to
function mediaPath(p) {
  if (!p) return '';
  p = p.replace(/^\/+/, '');
  if (outMap.has(p)) return outMap.get(p);
  const ext = path.extname(p).toLowerCase();
  return CONVERT_EXT.includes(ext) ? p.slice(0, -ext.length) + '.webp' : p;
}

async function toWebp(src, dest) {
  const animated = path.extname(src).toLowerCase() === '.gif';
  const meta = await sharp(src, { animated }).metadata();
  for (const quality of [82, 76, 70, 64, 58, 52]) {
    let img = sharp(src, { animated }).rotate();
    if (meta.width > MAX_WIDTH) img = img.resize({ width: MAX_WIDTH });
    const buf = await img.webp({ quality, effort: 5 }).toBuffer();
    if (buf.length <= MAX_BYTES || quality === 52) {
      fs.writeFileSync(dest, buf);
      return { quality, kb: Math.round(buf.length / 1024) };
    }
  }
}

// Grid thumbnails: 4:3 crops (top-aligned, so tall posters show their header) kept small so a
// category page with many works stays fast. Animated files are used as they are.
const THUMB_W = 900;
const THUMB_H = 675;
const thumbs = new Set();

// "works/a.webp" -> "works/thumbs/a.webp" when a thumbnail exists, otherwise the file itself
function thumbPath(p) {
  const name = path.basename(p);
  return thumbs.has(name) ? `works/thumbs/${name}` : p;
}

async function makeThumb(src, builtFile, outName) {
  const dir = path.join(DIST, 'works', 'thumbs');
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, outName);
  const meta = await sharp(src, { animated: true }).metadata();
  if ((meta.pages || 1) > 1) {
    fs.copyFileSync(builtFile, dest);
  } else {
    await sharp(src).rotate()
      .resize({ width: THUMB_W, height: THUMB_H, fit: 'cover', position: 'top' })
      .webp({ quality: 78 }).toFile(dest);
  }
  thumbs.add(outName);
}

async function buildMedia() {
  const srcDir = path.join(ROOT, 'works');
  const outDir = path.join(DIST, 'works');
  fs.mkdirSync(outDir, { recursive: true });
  const names = fs.readdirSync(srcDir).filter(n => !n.startsWith('.'));
  const stem = n => n.slice(0, -path.extname(n).length);
  const taken = new Set(names.filter(n => !CONVERT_EXT.includes(path.extname(n).toLowerCase())).map(n => n.toLowerCase()));
  for (const name of names) {
    const ext = path.extname(name).toLowerCase();
    if (!CONVERT_EXT.includes(ext)) continue;
    let out = stem(name) + '.webp';
    for (let i = 1; taken.has(out.toLowerCase()); i++) out = `${stem(name)}-upload${i > 1 ? i : ''}.webp`;
    taken.add(out.toLowerCase());
    outMap.set(`works/${name}`, `works/${out}`);
    if (out !== stem(name) + '.webp') console.log(`  note  ${name} shares a name with another file, saved as ${out}`);
  }
  for (const name of names) {
    const src = path.join(srcDir, name);
    const ext = path.extname(name).toLowerCase();
    if (CONVERT_EXT.includes(ext)) {
      const out = outMap.get(`works/${name}`).slice('works/'.length);
      const r = await toWebp(src, path.join(outDir, out));
      console.log(`  webp  ${name} -> ${out} (q${r.quality}, ${r.kb}KB)`);
      await makeThumb(src, path.join(outDir, out), out);
    } else {
      fs.copyFileSync(src, path.join(outDir, name));
      if (ext === '.webp') await makeThumb(src, path.join(outDir, name), name);
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

function youtubeId(url) {
  const m = String(url).match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/);
  return m ? m[1] : null;
}

// One grid tile per work; clicking it opens the big view (see lightbox.js, which reads the data-* attributes)
function renderTile(w, i) {
  const lazy = i < 6 ? '' : ' loading="lazy"';
  let type = 'image', src, thumb, badge = '';
  if (w.type === 'video') {
    type = 'video';
    src = mediaPath(w.video);
    thumb = `<video src="${esc(src)}#t=0.1" muted loop playsinline preload="metadata" tabindex="-1" aria-hidden="true"></video>`;
    badge = '<span class="tile-badge" aria-hidden="true"></span>';
  } else if (w.type === 'embed') {
    type = 'embed';
    src = embedUrl(w.url);
    const id = youtubeId(w.url);
    thumb = id
      ? `<img${lazy} decoding="async" src="https://i.ytimg.com/vi/${id}/maxresdefault.jpg" onerror="this.onerror=null;this.src='https://i.ytimg.com/vi/${id}/hqdefault.jpg'" alt="">`
      : '<span class="tile-placeholder" aria-hidden="true"></span>';
    badge = '<span class="tile-badge" aria-hidden="true"></span>';
  } else {
    src = mediaPath(w.image);
    thumb = `<img${lazy} decoding="async" src="${esc(thumbPath(src))}" alt="${esc(w.alt)}">`;
  }
  const label = w.alt ? `查看大圖：${w.alt}` : `查看作品 ${i + 1}`;
  const caption = w.caption ? ` data-caption="${esc(w.caption)}"` : '';
  return `            <button type="button" class="grid-item" data-type="${type}" data-src="${esc(src)}" data-alt="${esc(w.alt)}"${caption} aria-label="${esc(label)}">
                <span class="grid-thumb">${thumb}${badge}</span>
            </button>`;
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

  // Q版似顏繪 page (static content, only the Works dropdown is filled in)
  const customTpl = fs.readFileSync(path.join(ROOT, 'templates', 'custom.html'), 'utf8');
  fs.writeFileSync(path.join(DIST, 'custom.html'), fill(customTpl, { nav: workNav }));
  console.log('  page  custom.html');

  cats.forEach((c, idx) => {
    // "Other Works": the next 4 categories after this one, wrapping around
    const others = [];
    for (let k = 1; k < cats.length && others.length < 4; k++) others.push(cats[(idx + k) % cats.length]);
    const related = others.map(o => `            <a href="${page(o)}" class="related-item">
                <div class="related-thumb"><img loading="lazy" decoding="async" src="${esc(mediaPath(o.cover))}" alt=""></div>
                <div class="related-name">${esc(o.fullName)}</div>
                <div class="related-tag">${esc(o.en)}</div>
            </a>`).join('\n');
    const tabs = cats.map(o => `            <a href="${page(o)}" class="cat-tab${o === c ? ' is-active' : ''}"${o === c ? ' aria-current="page"' : ''}>${esc(o.name)}</a>`).join('\n');
    const works = (c.works || []).length
      ? c.works.map(renderTile).join('\n')
      : '            <p class="stack-empty">作品準備中，敬請期待。</p>';
    fs.writeFileSync(path.join(DIST, page(c)), fill(workTpl, {
      title: `${esc(c.fullName)} — Lemon Portfolio`,
      nav: workNav, tabs, en: esc(c.en), pageTitle: esc(c.pageTitle), works, related,
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
