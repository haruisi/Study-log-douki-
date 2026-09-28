(() => {
  const ENDPOINT = 'https://ghvqvlmkgajznxjerjsu.supabase.co/functions/v1/reco-images';
  const KEY = 'reco.sync.key.v1';
  const MAX_INPUT = 20 * 1024 * 1024;
  const urls = new Map();

  function key() {
    const value = localStorage.getItem(KEY);
    if (!value) throw new Error('画像の添付には端末間同期の設定が必要です。右上の雲マークから設定してください。');
    return value;
  }

  function pickerHTML() {
    return '<div class="reco-image-picker"><label class="btn btn-secondary reco-image-label">＋ 画像を添付<input type="file" accept="image/*" hidden></label><span class="reco-image-preview"></span></div>';
  }

  function bindPicker(form) {
    const input = form.querySelector('input[type="file"]');
    const preview = form.querySelector('.reco-image-preview');
    let previewUrl = null;
    input.addEventListener('change', () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = null;
      const file = input.files?.[0];
      preview.replaceChildren();
      if (!file) return;
      if (!file.type.startsWith('image/') || file.size > MAX_INPUT) {
        input.value = '';
        notice(file.size > MAX_INPUT ? '画像は20 MB以下を選んでください' : '画像ファイルを選んでください');
        return;
      }
      previewUrl = URL.createObjectURL(file);
      const image = document.createElement('img');
      image.src = previewUrl;
      image.alt = '添付画像のプレビュー';
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', '画像を取り消す');
      remove.onclick = () => {
        input.value = '';
        preview.replaceChildren();
        URL.revokeObjectURL(previewUrl);
        previewUrl = null;
      };
      preview.append(image, remove);
    });
    return () => input.files?.[0] || null;
  }

  function notice(message) {
    const toast = document.querySelector('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  async function jpeg(file) {
    let image;
    try { image = await createImageBitmap(file); }
    catch {
      const objectUrl = URL.createObjectURL(file);
      try {
        image = await new Promise((resolve, reject) => {
          const element = new Image();
          element.onload = () => resolve(element);
          element.onerror = () => reject(new Error('この画像を読み込めませんでした'));
          element.src = objectUrl;
        });
      } finally { URL.revokeObjectURL(objectUrl); }
    }
    const scale = Math.min(1, 2048 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    image.close?.();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .82));
    if (!blob || blob.size > 5 * 1024 * 1024) throw new Error('この画像をJPEGに変換できませんでした');
    return blob;
  }

  async function upload(file, sessionId) {
    const syncKey = key();
    await window.RecoSyncImages?.ensureSession();
    const blob = await jpeg(file);
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'X-Reco-Key': syncKey, 'X-Reco-Session': sessionId, 'Content-Type': 'image/jpeg' },
      body: blob
    });
    if (!response.ok) throw new Error(response.status === 401 ? '同期キーを確認してください' : response.status === 404 ? '同期完了後にもう一度お試しください' : '画像を保存できませんでした');
    return (await response.json()).path;
  }

  function imageHTML(reply) {
    return reply.imagePath ? `<a class="reco-reply-image-link" data-reco-path="${escapePath(reply.imagePath)}" target="_blank" rel="noopener"><img alt="返信に添付した画像" loading="lazy"></a>` : '';
  }

  function escapePath(value) {
    return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }

  async function hydrate(root) {
    const links = [...root.querySelectorAll('[data-reco-path]')];
    if (!links.length || !localStorage.getItem(KEY)) return;
    for (const link of links) {
      const path = link.dataset.recoPath;
      try {
        let url = urls.get(path);
        if (!url || url.expires < Date.now()) {
          const response = await fetch(ENDPOINT, { headers: { 'X-Reco-Key': key(), 'X-Reco-Path': path } });
          if (!response.ok) throw new Error('画像を読み込めませんでした');
          url = { value: (await response.json()).url, expires: Date.now() + 8 * 60 * 1000 };
          urls.set(path, url);
        }
        if (link.isConnected) { link.href = url.value; link.querySelector('img').src = url.value; }
      } catch { if (link.isConnected) link.replaceWith(document.createTextNode('画像を読み込めませんでした')); }
    }
  }

  window.RecoImages = { pickerHTML, bindPicker, upload, imageHTML, hydrate };
})();
