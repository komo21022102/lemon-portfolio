// Pop-up viewer for the works grid: click a tile to see the work large.
// Works with images, MP4 videos and YouTube/Vimeo embeds; Esc closes, arrow keys and swipes move between works.
(() => {
  const grid = document.querySelector('.work-grid');
  const box = document.getElementById('lightbox');
  if (!grid || !box) return;

  const tiles = [...grid.querySelectorAll('.grid-item')];
  const stage = document.getElementById('lbStage');
  const captionEl = document.getElementById('lbCaption');
  const countEl = document.getElementById('lbCount');
  const closeBtn = box.querySelector('.lb-close');
  let index = -1;
  let opener = null;

  box.classList.toggle('is-single', tiles.length < 2);

  function render(i) {
    const tile = tiles[i];
    const { type, src, alt = '', caption = '' } = tile.dataset;
    stage.innerHTML = '';
    stage.scrollTop = 0;
    stage.classList.remove('is-loading');

    if (type === 'video') {
      const v = document.createElement('video');
      v.src = src;
      v.controls = true;
      v.autoplay = true;
      v.loop = true;
      v.muted = true;
      v.playsInline = true;
      stage.appendChild(v);
    } else if (type === 'embed') {
      const wrap = document.createElement('div');
      wrap.className = 'lb-embed';
      const f = document.createElement('iframe');
      f.src = src + (src.includes('?') ? '&' : '?') + 'autoplay=1&rel=0';
      f.title = alt;
      f.allow = 'autoplay; fullscreen; picture-in-picture';
      f.allowFullscreen = true;
      wrap.appendChild(f);
      stage.appendChild(wrap);
    } else {
      stage.classList.add('is-loading');
      const img = new Image();
      img.alt = alt;
      img.onload = () => {
        if (img.naturalHeight / img.naturalWidth > 1.25) img.classList.add('is-tall');
        stage.classList.remove('is-loading');
      };
      img.onerror = () => stage.classList.remove('is-loading');
      img.src = src;
      stage.appendChild(img);
    }

    captionEl.textContent = caption;
    countEl.textContent = `${i + 1} / ${tiles.length}`;

    // warm up the neighbours so next/previous feels instant
    [i - 1, i + 1].forEach(n => {
      const t = tiles[(n + tiles.length) % tiles.length];
      if (t && t.dataset.type === 'image') new Image().src = t.dataset.src;
    });
  }

  function open(i, fromTile) {
    index = i;
    opener = fromTile || null;
    tiles.forEach(t => { const v = t.querySelector('video'); if (v) v.pause(); });
    render(i);
    box.classList.add('is-open');
    box.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    closeBtn.focus({ preventScroll: true });
  }

  function close() {
    if (index < 0) return;
    index = -1;
    box.classList.remove('is-open');
    box.setAttribute('aria-hidden', 'true');
    stage.innerHTML = ''; // also stops any playing video / embed
    document.body.style.overflow = '';
    if (opener) opener.focus({ preventScroll: true });
  }

  function step(d) {
    if (index < 0 || tiles.length < 2) return;
    index = (index + d + tiles.length) % tiles.length;
    render(index);
  }

  tiles.forEach((tile, i) => {
    tile.addEventListener('click', () => open(i, tile));
    const v = tile.querySelector('video');
    if (v) {
      // Many clips start blank, so show a frame from the middle of the clip as the tile image
      let still = 0.1;
      const pickStill = () => {
        if (v.duration > 1) { still = v.duration * 0.4; v.currentTime = still; }
      };
      if (v.readyState >= 1) pickStill();
      else v.addEventListener('loadedmetadata', pickStill, { once: true });
      tile.addEventListener('mouseenter', () => { v.play().catch(() => {}); });
      tile.addEventListener('mouseleave', () => { v.pause(); v.currentTime = still; });
    }
  });

  closeBtn.addEventListener('click', close);
  box.querySelector('.lb-prev').addEventListener('click', () => step(-1));
  box.querySelector('.lb-next').addEventListener('click', () => step(1));
  box.addEventListener('click', e => { if (e.target === box || e.target === stage) close(); });

  document.addEventListener('keydown', e => {
    if (index < 0) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
  });

  // keep keyboard focus inside the pop-up while it is open
  document.addEventListener('focusin', e => {
    if (index >= 0 && !box.contains(e.target)) closeBtn.focus({ preventScroll: true });
  });

  let startX = null;
  box.addEventListener('touchstart', e => { startX = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
  box.addEventListener('touchend', e => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    startX = null;
    if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1);
  }, { passive: true });
})();
