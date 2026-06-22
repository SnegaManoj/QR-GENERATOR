const els = {
  themeToggle: document.getElementById('themeToggle'),
  qrText: document.getElementById('qrText'),
  contentType: document.getElementById('contentType'),
  qrSize: document.getElementById('qrSize'),
  bodyStyle: document.getElementById('bodyStyle'),
  cornerFrameStyle: document.getElementById('cornerFrameStyle'),
  cornerDotStyle: document.getElementById('cornerDotStyle'),
  fgColor: document.getElementById('fgColor'),
  bgColor: document.getElementById('bgColor'),
  gradientEnabled: document.getElementById('gradientEnabled'),
  gradientStart: document.getElementById('gradientStart'),
  gradientEnd: document.getElementById('gradientEnd'),
  gradientAngle: document.getElementById('gradientAngle'),
  logoSize: document.getElementById('logoSize'),
  logoUpload: document.getElementById('logoUpload'),
  replaceLogoBtn: document.getElementById('replaceLogoBtn'),
  removeLogoBtn: document.getElementById('removeLogoBtn'),
  generateBtn: document.getElementById('generateBtn'),
  resetBtn: document.getElementById('resetBtn'),
  downloadPngBtn: document.getElementById('downloadPngBtn'),
  downloadSvgBtn: document.getElementById('downloadSvgBtn'),
  downloadJpgBtn: document.getElementById('downloadJpgBtn'),
  qrcode: document.getElementById('qrcode'),
  logoPreview: document.getElementById('logoPreview'),
  statusBadge: document.getElementById('statusBadge'),
  previewStatus: document.getElementById('previewStatus'),
  previewSize: document.getElementById('previewSize'),
  logoSafety: document.getElementById('logoSafety'),
  scanQuality: document.getElementById('scanQuality'),
  message: document.getElementById('message'),
};

const STORAGE_KEY = 'qr-generator-theme-v1';
const state = {
  theme: localStorage.getItem(STORAGE_KEY) || 'dark',
  qr: null,
  logoDataUrl: '',
  logoMeta: null,
  logoWarning: '',
  logoColors: null,
  renderQueued: false,
  isRendering: false,
  signature: '',
};

function setMessage(text, type = '') {
  els.message.textContent = text;
  els.message.className = `message ${type}`.trim();
}

function setStatus(text, tone = 'neutral') {
  els.statusBadge.textContent = text;
  els.statusBadge.dataset.tone = tone;
  els.previewStatus.textContent = text;
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  state.theme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
  els.themeToggle.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
}

function escapeFilename(input) {
  return String(input || 'qr-code')
    .trim()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'qr-code';
}

function detectType(value) {
  const text = String(value || '').trim();
  if (/^https?:\/\//i.test(text) || /^www\./i.test(text)) return 'url';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return 'email';
  if (/^\+?[0-9()\-\s]{7,}$/.test(text)) return 'phone';
  if (/^https?:\/\/(wa\.me|api\.whatsapp\.com)/i.test(text) || /^whatsapp:/i.test(text)) return 'whatsapp';
  return 'text';
}

function normalizeContent() {
  const value = String(els.qrText.value || '').trim();
  if (!value) throw new Error('Enter content before generating a QR code.');

  const type = els.contentType.value === 'auto' ? detectType(value) : els.contentType.value;
  if (type === 'url') return value.startsWith('http://') || value.startsWith('https://') ? value : `https://${value}`;
  if (type === 'email') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error('Enter a valid email address.');
    return value.startsWith('mailto:') ? value : `mailto:${value}`;
  }
  if (type === 'phone') {
    if (!/^\+?[0-9()\-\s]{7,}$/.test(value)) throw new Error('Enter a valid phone number.');
    return value.startsWith('tel:') ? value : `tel:${value.replace(/\s+/g, '')}`;
  }
  if (type === 'whatsapp') {
    const raw = value.replace(/[^\d+]/g, '').replace(/^00/, '+');
    const cleaned = raw.replace('+', '');
    if (!cleaned || !/^[0-9]{7,15}$/.test(cleaned)) throw new Error('Enter a valid WhatsApp number or wa.me link.');
    return `https://wa.me/${cleaned}`;
  }
  return value;
}

function shapeMap() {
  return {
    body: {
      square: 'square',
      rounded: 'rounded',
      dot: 'dots',
      diamond: 'classy-rounded',
    }[els.bodyStyle.value] || 'rounded',
    cornerFrame: {
      square: 'square',
      rounded: 'extra-rounded',
      circle: 'extra-rounded',
    }[els.cornerFrameStyle.value] || 'extra-rounded',
    cornerDot: {
      square: 'square',
      circle: 'dots',
      rounded: 'rounded',
    }[els.cornerDotStyle.value] || 'dot',
  };
}

function getGradient() {
  if (!els.gradientEnabled.checked) return null;
  return {
    type: 'linear',
    rotation: Number(els.gradientAngle.value || 0),
    colorStops: [
      { offset: 0, color: els.gradientStart.value },
      { offset: 1, color: els.gradientEnd.value },
    ],
  };
}

function getSignature() {
  return [
    els.qrText.value,
    els.contentType.value,
    els.qrSize.value,
    els.bodyStyle.value,
    els.cornerFrameStyle.value,
    els.cornerDotStyle.value,
    els.fgColor.value,
    els.bgColor.value,
    els.gradientEnabled.checked,
    els.gradientStart.value,
    els.gradientEnd.value,
    els.gradientAngle.value,
    els.logoSize.value,
    state.logoDataUrl ? 'logo' : 'nologo',
    state.logoWarning,
  ].join('|');
}

function updatePreviewLayout() {
  const size = Number(els.qrSize.value || 400);
  els.previewSize.textContent = `${size}px`;
  els.qrcode.style.width = `${size}px`;
  els.qrcode.style.height = `${size}px`;
  els.logoPreview.style.width = `${size * (Number(els.logoSize.value || 18) / 100)}px`;
  els.logoPreview.style.height = 'auto';
  els.logoPreview.style.maxWidth = '30%';
  els.logoPreview.style.maxHeight = '30%';
}

function clearPreview() {
  els.qrcode.innerHTML = '';
  state.qr = null;
}

function applyLogoWarning(sizePercent) {
  if (sizePercent > 24) {
    state.logoWarning = 'Warning: logo may be too large and affect scan accuracy.';
    els.logoSafety.textContent = 'Warning';
    els.logoSafety.classList.add('warning');
    return;
  }
  state.logoWarning = '';
  els.logoSafety.textContent = 'Safe';
  els.logoSafety.classList.remove('warning');
}

async function analyzeLogoColors(dataUrl) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 48;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(image, 0, 0, size, size);
      const { data } = ctx.getImageData(0, 0, size, size);
      const samples = [];
      for (let i = 0; i < data.length; i += 16) {
        const alpha = data[i + 3];
        if (alpha < 64) continue;
        samples.push([data[i], data[i + 1], data[i + 2]]);
      }
      if (!samples.length) {
        resolve(['#0f172a', '#7c3aed']);
        return;
      }
      const avg = samples.reduce((acc, rgb) => {
        acc[0] += rgb[0];
        acc[1] += rgb[1];
        acc[2] += rgb[2];
        return acc;
      }, [0, 0, 0]).map(v => Math.round(v / samples.length));
      const darkest = samples.reduce((best, rgb) => {
        const lum = rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114;
        return lum < best.lum ? { rgb, lum } : best;
      }, { rgb: avg, lum: 999 }).rgb;
      const lighten = rgb => rgb.map(v => Math.min(255, Math.round(v * 1.25 + 20)));
      const toHex = rgb => `#${rgb.map(v => v.toString(16).padStart(2, '0')).join('')}`;
      resolve([toHex(darkest), toHex(lighten(avg))]);
    };
    image.onerror = () => resolve(['#0f172a', '#7c3aed']);
    image.src = dataUrl;
  });
}

function updateSuggestedColors(primary, secondary) {
  els.fgColor.value = primary;
  els.gradientStart.value = primary;
  els.gradientEnd.value = secondary;
}

function getQrOptions(data) {
  const size = Number(els.qrSize.value || 400) * Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const logoRatio = Number(els.logoSize.value || 18) / 100;
  const safeLogoSize = Math.min(0.24, Math.max(0.10, logoRatio));
  const shapes = shapeMap();
  return {
    width: size,
    height: size,
    type: 'svg',
    data,
    margin: 20,
    qrOptions: { errorCorrectionLevel: 'H' },
    image: state.logoDataUrl || undefined,
    imageOptions: {
      imageSize: safeLogoSize,
      margin: 8,
      hideBackgroundDots: true,
      crossOrigin: 'anonymous',
      saveAsBlob: true,
    },
    dotsOptions: {
      type: shapes.body,
      color: els.gradientEnabled.checked ? undefined : els.fgColor.value,
      gradient: getGradient() || undefined,
    },
    cornersSquareOptions: {
      type: shapes.cornerFrame,
      color: els.fgColor.value,
    },
    cornersDotOptions: {
      type: shapes.cornerDot,
      color: els.fgColor.value,
    },
    backgroundOptions: {
      color: els.bgColor.value,
    },
  };
}

function renderQr() {
  const content = normalizeContent();
  const options = getQrOptions(content);
  setStatus('Rendering...', 'neutral');
  state.isRendering = true;

  if (state.qr) {
    state.qr.update(options);
  } else {
    clearPreview();
    state.qr = new QRCodeStyling(options);
    state.qr.append(els.qrcode);
  }

  state.isRendering = false;
  setStatus('QR Ready', 'success');
  els.scanQuality.textContent = 'High error correction enabled';
  setMessage('QR updated instantly.', 'success');
}

function scheduleRender() {
  if (state.renderQueued) return;
  state.renderQueued = true;
  requestAnimationFrame(() => {
    state.renderQueued = false;
    try {
      const sig = getSignature();
      updatePreviewLayout();
      if (!els.qrText.value.trim()) {
        clearPreview();
        setStatus('Ready', 'neutral');
        return;
      }
      if (sig === state.signature && state.qr && !state.isRendering) {
        return;
      }
      renderQr();
      state.signature = sig;
    } catch (error) {
      state.isRendering = false;
      clearPreview();
      setStatus('Error', 'danger');
      setMessage(error?.message || 'Failed to render QR code.', 'error');
    }
  });
}

function resetForm() {
  els.qrText.value = '';
  els.contentType.value = 'auto';
  els.qrSize.value = '400';
  els.bodyStyle.value = 'rounded';
  els.cornerFrameStyle.value = 'rounded';
  els.cornerDotStyle.value = 'circle';
  els.fgColor.value = '#0f172a';
  els.bgColor.value = '#ffffff';
  els.gradientEnabled.checked = false;
  els.gradientStart.value = '#0f172a';
  els.gradientEnd.value = '#7c3aed';
  els.gradientAngle.value = '0';
  els.logoSize.value = '18';
  removeLogo(true);
  applyTheme(state.theme);
  state.signature = '';
  updatePreviewLayout();
  clearPreview();
  setStatus('Ready', 'neutral');
  els.logoSafety.textContent = 'Safe';
  setMessage('Fields reset.', 'success');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadPng() {
  if (!state.qr) return setMessage('Generate a QR code first.', 'error');
  const blob = await state.qr.getRawData('png');
  downloadBlob(blob, `${escapeFilename(els.qrText.value)}.png`);
}

async function downloadSvg() {
  if (!state.qr) return setMessage('Generate a QR code first.', 'error');
  const blob = await state.qr.getRawData('svg');
  downloadBlob(blob, `${escapeFilename(els.qrText.value)}.svg`);
}

async function downloadJpg() {
  if (!state.qr) return setMessage('Generate a QR code first.', 'error');
  const blob = await state.qr.getRawData('png');
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = els.bgColor.value;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  canvas.toBlob(blobOut => {
    if (!blobOut) return setMessage('JPG export failed.', 'error');
    downloadBlob(blobOut, `${escapeFilename(els.qrText.value)}.jpg`);
  }, 'image/jpeg', 0.96);
}

function removeLogo(silent = false) {
  state.logoDataUrl = '';
  state.logoMeta = null;
  state.logoColors = null;
  els.logoUpload.value = '';
  els.logoPreview.classList.add('hidden');
  els.logoPreview.removeAttribute('src');
  els.logoPreview.removeAttribute('alt');
  applyLogoWarning(Number(els.logoSize.value || 18));
  if (!silent) {
    scheduleRender();
    setMessage('Logo removed.', 'success');
  }
}

async function handleLogoFile(file) {
  if (!file) return;
  if (!['image/png', 'image/jpeg'].includes(file.type)) {
    setMessage('Please upload a PNG or JPG logo.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = async () => {
    state.logoDataUrl = String(reader.result || '');
    state.logoMeta = { name: file.name, type: file.type };
    els.logoPreview.src = state.logoDataUrl;
    els.logoPreview.alt = file.name;
    els.logoPreview.classList.remove('hidden');
    const [primary, secondary] = await analyzeLogoColors(state.logoDataUrl);
    state.logoColors = { primary, secondary };
    updateSuggestedColors(primary, secondary);
    applyLogoWarning(Number(els.logoSize.value || 18));
    setMessage('Logo uploaded. Colors updated automatically.', 'success');
    scheduleRender();
  };
  reader.onerror = () => setMessage('Failed to read the selected logo.', 'error');
  reader.readAsDataURL(file);
}

function initEvents() {
  [
    els.qrText,
    els.contentType,
    els.qrSize,
    els.bodyStyle,
    els.cornerFrameStyle,
    els.cornerDotStyle,
    els.fgColor,
    els.bgColor,
    els.gradientEnabled,
    els.gradientStart,
    els.gradientEnd,
    els.gradientAngle,
    els.logoSize,
  ].forEach(el => {
    el.addEventListener('input', () => {
      updatePreviewLayout();
      applyLogoWarning(Number(els.logoSize.value || 18));
      scheduleRender();
    });
    el.addEventListener('change', () => {
      updatePreviewLayout();
      applyLogoWarning(Number(els.logoSize.value || 18));
      scheduleRender();
    });
  });

  els.generateBtn.addEventListener('click', scheduleRender);
  els.resetBtn.addEventListener('click', resetForm);
  els.downloadPngBtn.addEventListener('click', downloadPng);
  els.downloadSvgBtn.addEventListener('click', downloadSvg);
  els.downloadJpgBtn.addEventListener('click', downloadJpg);
  els.themeToggle.addEventListener('click', () => applyTheme(state.theme === 'dark' ? 'light' : 'dark'));
  els.logoUpload.addEventListener('change', e => handleLogoFile(e.target.files?.[0]));
  els.replaceLogoBtn.addEventListener('click', () => {
    els.logoUpload.value = '';
    els.logoUpload.click();
  });
  els.removeLogoBtn.addEventListener('click', () => removeLogo(false));
}

function bootstrap() {
  applyTheme(state.theme);
  updatePreviewLayout();
  applyLogoWarning(Number(els.logoSize.value || 18));
  setStatus('Ready', 'neutral');
  setMessage('Ready to generate your QR code.', 'success');
  initEvents();
}

bootstrap();
