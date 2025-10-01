(() => {
  'use strict';

  // --- ELEMENT SELECTORS ---
  const $ = (id) => document.getElementById(id);
  const iCanvas = $('iCanvas'), ctx = iCanvas.getContext('2d', { willReadFrequently: true });
  const iDrop = $('iDrop'), iFile = $('iFile');
  // History
  const iUndo = $('iUndo'), iRedo = $('iRedo'), iReset = $('iReset');
  // Size & Fit
  const iSize = $('iSize');
  const iRotateLeft = $('iRotateLeft'), iRotateRight = $('iRotateRight');
  const iFlipH = $('iFlipH'), iFlipV = $('iFlipV'), iSafeArea = $('iSafeArea');
  // Crop
  const iCropMode = $('iCropMode'), iApplyCrop = $('iApplyCrop'), iAutoTrim = $('iAutoTrim');
  // Background
  const iPickColor = $('iPickColor'), iTolerance = $('iTolerance'), iTolVal = $('iTolVal');
  const iApplyBG = $('iApplyBG'), iAutoBG = $('iAutoBG');
  // Outline & Shadow
  const iOutlineColor = $('iOutlineColor'), iOutlineW = $('iOutlineW'), iOutlineWVal = $('iOutlineWVal');
  const iApplyOutline = $('iApplyOutline');
  const iShadowColor = $('iShadowColor'), iShadowBlur = $('iShadowBlur'), iShBlurVal = $('iShBlurVal');
  const iShadowX = $('iShadowX'), iShXVal = $('iShXVal'), iShadowY = $('iShadowY'), iShYVal = $('iShYVal');
  const iApplyShadow = $('iApplyShadow');
  // Text
  const iText = $('iText'), iTextSize = $('iTextSize'), iTextFill = $('iTextFill');
  const iTextStroke = $('iTextStroke'), iTextStrokeW = $('iTextStrokeW'), iTextStrokeWVal = $('iTextStrokeWVal');
  const iAddText = $('iAddText'), iCommitText = $('iCommitText');
  // Export
  const iTargetKB = $('iTargetKB'), iKBTarget = $('iKBTarget');
  const iExport = $('iExport'), iAddToPack = $('iAddToPack');
  // Pack
  const iPackName = $('iPackName'), iPackPublisher = $('iPackPublisher');
  const iPackList = $('iPackList'), iDownloadZip = $('iDownloadZip');

  // --- STATE MANAGEMENT ---
  const state = {
    srcImg: null, srcName: 'sticker',
    angle: 0, flipH: false, flipV: false,
    fit: 'contain', outSize: 512, showSafe: 0,
    crop: null, cropMode: false,
    targetKB: 95,
    pack: [], // { name, blob }
    textOverlay: null,
    hist: [], histIdx: -1,
  };

  // Base working canvas (full-res source)
  let baseCanvas = document.createElement('canvas');
  let baseCtx = baseCanvas.getContext('2d', { willReadFrequently: true });

  // --- HELPERS ---
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const slugify = (text) => text.toString().toLowerCase().trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-') || 'sticker';

  // --- HISTORY (UNDO/REDO) ---
  function pushHist() {
    if (!baseCanvas.width || !baseCanvas.height) return;
    const snap = baseCtx.getImageData(0, 0, baseCanvas.width, baseCanvas.height);
    state.hist = state.hist.slice(0, state.histIdx + 1);
    state.hist.push(snap);
    if (state.hist.length > 20) state.hist.shift(); // Limit history stack
    state.histIdx = state.hist.length - 1;
    updateHistoryButtons();
  }

  function applyHist(index) {
    if (index < 0 || index >= state.hist.length) return;
    const imgData = state.hist[index];
    baseCanvas.width = imgData.width;
    baseCanvas.height = imgData.height;
    baseCtx.putImageData(imgData, 0, 0);
    state.histIdx = index;
    drawStage();
    updateHistoryButtons();
  }
  
  function updateHistoryButtons() {
    iUndo.disabled = state.histIdx <= 0;
    iRedo.disabled = state.histIdx >= state.hist.length - 1;
  }

  // --- IMAGE LOADING ---
  function resetAll() {
    state.angle = 0; state.flipH = false; state.flipV = false;
    state.fit = 'contain';
    const img = state.srcImg;
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    baseCanvas.width = w; baseCanvas.height = h;
    baseCtx.clearRect(0, 0, w, h);
    baseCtx.drawImage(img, 0, 0);
    state.crop = { x: 0, y: 0, w, h };
    state.hist = [];
    state.histIdx = -1;
    pushHist();
    drawStage();
  }

  function loadFile(file) {
    if (!file || !/image\/(png|jpeg|webp)/.test(file.type)) return;
    const img = new Image();
    img.onload = () => {
      state.srcImg = img;
      state.srcName = file.name.replace(/\.[^/.]+$/, "");
      resetAll();
    };
    img.onerror = () => alert('Could not load image.');
    img.src = URL.createObjectURL(file);
  }

  // --- CORE DRAWING LOGIC ---
  function drawStage() {
    if (!state.srcImg) return;
    const size = state.outSize;
    iCanvas.width = size; iCanvas.height = size;
    ctx.clearRect(0, 0, size, size);

    const fitRect = (w, h, W, H, mode) => {
        const r = w / h, R = W / H;
        let cW, cH;
        if (mode === 'contain' ? r > R : r < R) { cW = W; cH = W / r; } 
        else { cH = H; cW = H * r; }
        return { w: Math.round(cW), h: Math.round(cH) };
    };

    const target = fitRect(baseCanvas.width, baseCanvas.height, size, size, state.fit);
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate((state.angle * Math.PI) / 180);
    ctx.scale(state.flipH ? -1 : 1, state.flipV ? -1 : 1);
    ctx.drawImage(baseCanvas, -target.w / 2, -target.h / 2, target.w, target.h);
    ctx.restore();

    iCanvas.parentElement.setAttribute('data-safe', state.showSafe ? '1' : '0');
    if (state.cropMode) drawCropOverlay();
    if (state.textOverlay) drawTextOverlay();
  }

  // --- FEATURE IMPLEMENTATIONS ---

  // CROP
  const dragSel = { active: false, start: {x:0, y:0}, rect: {x:0, y:0, w:0, h:0} };
  function drawCropOverlay() { /* ... implementation from your code ... */ }
  function onPointerDown(e) { if (!state.cropMode) return; /* ... */ }
  function onPointerMove(e) { if (!state.cropMode || !dragSel.active) return; /* ... */ }
  function onPointerUp(e) { if (!state.cropMode || !dragSel.active) return; /* ... */ }

  function applyCrop() {
    if (!state.srcImg || !dragSel.rect.w || !dragSel.rect.h) return;
    const previewRect = dragSel.rect;
    const scaleX = baseCanvas.width / iCanvas.width;
    const scaleY = baseCanvas.height / iCanvas.height;
    
    // This is a simplified mapping. A more robust solution would account for fit/transforms.
    const sourceX = previewRect.x * scaleX;
    const sourceY = previewRect.y * scaleY;
    const sourceW = previewRect.w * scaleX;
    const sourceH = previewRect.h * scaleY;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = sourceW;
    tempCanvas.height = sourceH;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(baseCanvas, sourceX, sourceY, sourceW, sourceH, 0, 0, sourceW, sourceH);

    baseCanvas.width = sourceW;
    baseCanvas.height = sourceH;
    baseCtx.drawImage(tempCanvas, 0, 0);
    
    state.cropMode = false;
    iCropMode.textContent = 'Select Area';
    dragSel.rect = {x:0, y:0, w:0, h:0};
    pushHist();
    drawStage();
  }

  // BACKGROUND REMOVAL
  function removeBackgroundColor() {
    const hex = iPickColor.value;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const tol = +iTolerance.value;
    const imgData = baseCtx.getImageData(0, 0, baseCanvas.width, baseCanvas.height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const dR = data[i] - r;
      const dG = data[i + 1] - g;
      const dB = data[i + 2] - b;
      if (Math.sqrt(dR * dR + dG * dG + dB * dB) < tol) {
        data[i + 3] = 0; // Set alpha to 0
      }
    }
    baseCtx.putImageData(imgData, 0, 0);
    pushHist();
    drawStage();
  }

  // OUTLINE & SHADOW
  function applyOutline() {
    const width = +iOutlineW.value;
    if (width === 0) return;
    const color = iOutlineColor.value;
    const w = baseCanvas.width, h = baseCanvas.height;
    const temp = document.createElement('canvas');
    const tCtx = temp.getContext('2d');
    temp.width = w + width * 2;
    temp.height = h + width * 2;

    tCtx.drawImage(baseCanvas, width, width);
    tCtx.globalCompositeOperation = 'source-in';
    tCtx.fillStyle = color;
    tCtx.fillRect(0, 0, temp.width, temp.height);
    tCtx.globalCompositeOperation = 'destination-over';
    tCtx.drawImage(temp, -1, -1); tCtx.drawImage(temp, 1, -1); tCtx.drawImage(temp, -1, 1); tCtx.drawImage(temp, 1, 1);
    tCtx.globalCompositeOperation = 'source-over';
    tCtx.drawImage(baseCanvas, width, width);

    baseCanvas.width = temp.width; baseCanvas.height = temp.height;
    baseCtx.drawImage(temp, 0, 0);
    pushHist();
    drawStage();
  }
  
  function applyShadow() {
    const blur = +iShadowBlur.value;
    const offX = +iShadowX.value;
    const offY = +iShadowY.value;
    const color = iShadowColor.value;
    if (blur === 0 && offX === 0 && offY === 0) return;

    const margin = blur * 2;
    const temp = document.createElement('canvas');
    const tCtx = temp.getContext('2d');
    temp.width = baseCanvas.width + Math.abs(offX) + margin;
    temp.height = baseCanvas.height + Math.abs(offY) + margin;

    tCtx.shadowColor = color;
    tCtx.shadowBlur = blur;
    tCtx.shadowOffsetX = offX;
    tCtx.shadowOffsetY = offY;
    tCtx.drawImage(baseCanvas, margin/2 - (offX < 0 ? offX : 0), margin/2 - (offY < 0 ? offY : 0));
    tCtx.shadowColor = 'transparent'; // Reset shadow for next draw
    tCtx.drawImage(baseCanvas, margin/2 - (offX < 0 ? offX : 0), margin/2 - (offY < 0 ? offY : 0));

    baseCanvas.width = temp.width; baseCanvas.height = temp.height;
    baseCtx.drawImage(temp, 0, 0);
    pushHist();
    drawStage();
  }


  // TEXT
  function drawTextOverlay() {
    const txt = state.textOverlay;
    if (!txt) return;
    ctx.font = `${txt.size}px ${getComputedStyle(document.body).fontFamily}`;
    ctx.fillStyle = txt.fill;
    ctx.strokeStyle = txt.stroke;
    ctx.lineWidth = txt.strokeW;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if(txt.strokeW > 0) ctx.strokeText(txt.text, txt.x, txt.y);
    ctx.fillText(txt.text, txt.x, txt.y);
  }

  function commitText() {
    if(!state.textOverlay) return;
    const txt = state.textOverlay;
    // Map preview coordinates to base canvas
    const scale = baseCanvas.width / iCanvas.width;
    baseCtx.font = `${txt.size * scale}px ${getComputedStyle(document.body).fontFamily}`;
    baseCtx.fillStyle = txt.fill;
    baseCtx.strokeStyle = txt.stroke;
    baseCtx.lineWidth = txt.strokeW * scale;
    baseCtx.textAlign = 'center';
    baseCtx.textBaseline = 'middle';
    if(txt.strokeW > 0) baseCtx.strokeText(txt.text, baseCanvas.width/2, baseCanvas.height/2);
    baseCtx.fillText(txt.text, baseCanvas.width/2, baseCanvas.height/2); // Simplified centering
    
    state.textOverlay = null;
    iCommitText.disabled = true;
    pushHist();
    drawStage();
  }
  
  // EXPORT & PACK
  async function getFinalBlob() {
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = 512; finalCanvas.height = 512;
    const fCtx = finalCanvas.getContext('2d');
    fCtx.drawImage(iCanvas, 0, 0, 512, 512);

    let quality = 0.9, bestBlob = null;
    for(let i=0; i < 7; i++) { // Binary search for quality
        const blob = await new Promise(res => finalCanvas.toBlob(b => res(b), 'image/webp', quality));
        if (!blob) break;
        if (blob.size / 1024 <= state.targetKB) {
            bestBlob = blob;
            quality += (1.0 - quality) / 2;
        } else {
            quality -= (quality - 0.1) / 2;
        }
    }
    return bestBlob || new Promise(res => finalCanvas.toBlob(b => res(b), 'image/webp', 0.8));
  }
  
  async function exportWebP() {
      const blob = await getFinalBlob();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slugify(state.srcName)}.webp`;
      a.click();
      URL.revokeObjectURL(url);
  }

  async function addToPack() {
      const blob = await getFinalBlob();
      if (!blob) return;
      const name = `${slugify(state.srcName || 'sticker')}-${state.pack.length + 1}.webp`;
      state.pack.push({ name, blob });
      renderPack();
  }
  
  function renderPack() {
    iPackList.innerHTML = '';
    state.pack.forEach((sticker, index) => {
        const thumb = document.createElement('div');
        thumb.className = 'i-thumb';
        const img = document.createElement('img');
        img.src = URL.createObjectURL(sticker.blob);
        const del = document.createElement('button');
        del.className = 'i-del';
        del.textContent = 'X';
        del.onclick = () => {
            state.pack.splice(index, 1);
            renderPack();
        };
        thumb.append(img, del);
        iPackList.appendChild(thumb);
    });
  }
  
  function downloadZip() {
    if (state.pack.length === 0) return;
    const zip = new JSZip();
    const folder = zip.folder(slugify(iPackName.value || 'sticker-pack'));
    state.pack.forEach(sticker => {
        folder.file(sticker.name, sticker.blob);
    });
    zip.generateAsync({type:"blob"}).then(content => {
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${slugify(iPackName.value || 'sticker-pack')}.zip`;
        a.click();
        URL.revokeObjectURL(url);
    });
  }

  // --- EVENT LISTENERS INITIALIZATION ---
  function init() {
    // File
    iDrop.addEventListener('click', () => iFile.click());
    iFile.addEventListener('change', (e) => loadFile(e.target.files[0]));
    window.addEventListener('paste', e => {
        const file = e.clipboardData.items[0].getAsFile();
        if(file) loadFile(file);
    });

    // History
    iUndo.addEventListener('click', () => applyHist(state.histIdx - 1));
    iRedo.addEventListener('click', () => applyHist(state.histIdx + 1));
    iReset.addEventListener('click', resetAll);
    
    // Transforms
    document.querySelectorAll('[data-fit]').forEach(b => b.addEventListener('click', (e) => { state.fit = e.target.dataset.fit; drawStage(); }));
    iRotateLeft.addEventListener('click', () => { state.angle = (state.angle - 90) % 360; drawStage(); });
    iRotateRight.addEventListener('click', () => { state.angle = (state.angle + 90) % 360; drawStage(); });
    iFlipH.addEventListener('click', () => { state.flipH = !state.flipH; drawStage(); });
    iFlipV.addEventListener('click', () => { state.flipV = !state.flipV; drawStage(); });
    iSafeArea.addEventListener('click', () => { state.showSafe = !state.showSafe; drawStage(); });
    
    // Crop
    iCropMode.addEventListener('click', () => { state.cropMode = !state.cropMode; iCropMode.textContent = state.cropMode ? 'Cancel' : 'Select Area'; drawStage(); });
    iApplyCrop.addEventListener('click', applyCrop);
    
    // Background
    iApplyBG.addEventListener('click', removeBackgroundColor);
    iTolerance.addEventListener('input', () => iTolVal.textContent = iTolerance.value);
    
    // Outline & Shadow
    iApplyOutline.addEventListener('click', applyOutline);
    iApplyShadow.addEventListener('click', applyShadow);
    iOutlineW.addEventListener('input', () => iOutlineWVal.textContent = iOutlineW.value);
    iShadowBlur.addEventListener('input', () => iShBlurVal.textContent = iShadowBlur.value);
    iShadowX.addEventListener('input', () => iShXVal.textContent = iShadowX.value);
    iShadowY.addEventListener('input', () => iShYVal.textContent = iShadowY.value);

    // Text
    iAddText.addEventListener('click', () => {
        if (!iText.value.trim()) return;
        state.textOverlay = {
            text: iText.value,
            x: iCanvas.width / 2, y: iCanvas.height / 2,
            size: +iTextSize.value, fill: iTextFill.value,
            stroke: iTextStroke.value, strokeW: +iTextStrokeW.value,
        };
        iCommitText.disabled = false;
        drawStage();
    });
    iCommitText.addEventListener('click', commitText);
    iTextStrokeW.addEventListener('input', () => iTextStrokeWVal.textContent = iTextStrokeW.value);
    
    // Export
    iTargetKB.addEventListener('input', () => { state.targetKB = +iTargetKB.value; iKBTarget.textContent = state.targetKB; });
    iExport.addEventListener('click', exportWebP);
    iAddToPack.addEventListener('click', addToPack);
    iDownloadZip.addEventListener('click', downloadZip);
  }

  init(); // Run the app
})();
