// LINE ID copy for custom.html
(() => {
  const copy = document.getElementById('copyLine');
  if (!copy) return;
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText('komo2102');
      copy.textContent = '已複製';
    } catch (e) {
      copy.textContent = 'LINE ID：komo2102';
    }
    setTimeout(() => { copy.textContent = '複製 LINE ID'; }, 2000);
  });
})();
