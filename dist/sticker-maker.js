(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const iCanvas = $('iCanvas');
  const ctx = iCanvas.getContext('2d', { willReadFrequently: true });

  // Base working canvas
  let baseCanvas = document.createElement('canvas');
  let baseCtx = baseCanvas.getContext('2d', { willReadFrequently: true });

  const state = {
    srcImg: null,
    angle: 0, flipH: false, flipV: false,
    fit: 'contain',
    outSize: 512,
    crop: null, // {x,y,w,h}
    cropMode: false,
    targetKB: 95,
    pack: [],
    // Undo/redo stacks of dataURLs
    undo: [], redo: [],
    // Advanced tools
    wandMode: null, // 'remove' | 'keep' | null
    wandTol: 28, feather: 2,
    lassoActive: false, lassoPts: [], lassoFeather: 2, lassoMode: null,
    eraseMode: false, eraseSize: 22,
    safeMargin: 8
  };

  function resetBase(img) {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    baseCanvas.width = w;
    baseCanvas.height = h;
    baseCtx.clearRect(0,0,w,h);
    baseCtx.drawImage(img, 0, 0);
    state.crop = { x: 0, y: 0, w, h };
  }

  function setCanvasSize(size){ iCanvas.width = size; iCanvas.height = size; }
  function fitRect(w, h, W, H, mode='contain'){
    const r=w/h, R=W/H; let width,height;
    if(mode==='contain'){ if(r>R){ width=W; height=W/r; } else { height=H; width=H*r; } }
    else { if(r>R){ height=H; width=H*r; } else { width=W; height=W/r; } }
    return { w:Math.round(width), h:Math.round(height) };
  }

  function drawStage() {
    const size = state.outSize; setCanvasSize(size);
    ctx.clearRect(0,0,size,size);
    if(!state.srcImg) return;
    const {x,y,w,h} = state.crop;
    const target = fitRect(w,h,size,size,state.fit);
    ctx.save();
    ctx.translate(size/2, size/2);
    ctx.rotate((state.angle*Math.PI)/180);
    ctx.scale(state.flipH?-1:1, state.flipV?-1:1);
    ctx.drawImage(baseCanvas, x,y,w,h, -target.w/2, -target.h/2, target.w, target.h);
    ctx.restore();
    if(state.cropMode) drawCropOverlay();
    if(state.lassoActive) drawLassoOverlay();
  }

  // Mapping from stage coords -> base image coords (absolute)
  function stageToSource(sx, sy){
    const size = state.outSize;
    let x = sx - size/2, y = sy - size/2;
    // inverse rotation
    const th = -(state.angle*Math.PI)/180, c=Math.cos(th), s=Math.sin(th);
    let xr = x*c - y*s, yr = x*s + y*c;
    // inverse flips
    if(state.flipH) xr = -xr;
    if(state.flipV) yr = -yr;
    const {w,h} = state.crop;
    const target = fitRect(w, h, size, size, state.fit);
    const hw = target.w/2, hh = target.h/2;
    if (xr < -hw || xr > hw || yr < -hh || yr > hh) return null;
    const nx = (xr + hw) / target.w, ny = (yr + hh) / target.h;
    return { x: state.crop.x + nx * w, y: state.crop.y + ny * h };
  }

  // Loaders
  function loadFile(file){
    if(!file) return;
    if(!/image\/(png|jpeg|webp)/.test(file.type)){ alert('Please use PNG, JPG, or WebP'); return; }
    const img = new Image();
    img.onload = () => { state.srcImg = img; resetBase(img); clearHistory(); drawStage(); };
    img.onerror = () => alert('Could not load image.');
    img.src = URL.createObjectURL(file);
  }

  // History
  function pushUndo(){
    try{
      const url = baseCanvas.toDataURL('image/png');
      state.undo.push(url);
      if(state.undo.length>12) state.undo.shift();
      state.redo = [];
    }catch(_){}
  }
  function restoreFromURL(url, cb){
    const img = new Image();
    img.onload = () => { baseCanvas.width=img.width; baseCanvas.height=img.height; baseCtx.clearRect(0,0,img.width,img.height); baseCtx.drawImage(img,0,0); if(cb) cb(); drawStage(); };
    img.src = url;
  }
  function undo(){
    if(!state.undo.length) return;
    const url = state.undo.pop();
    const cur = baseCanvas.toDataURL('image/png');
    state.redo.push(cur);
    restoreFromURL(url);
  }
  function redo(){
    if(!state.redo.length) return;
    const url = state.redo.pop();
    const cur = baseCanvas.toDataURL('image/png');
    state.undo.push(cur);
    restoreFromURL(url);
  }
  function clearHistory(){ state.undo=[]; state.redo=[]; }

  // UI bindings
  const iDrop = $('iDrop'), iFile=$('iFile');
  iDrop.addEventListener('click',()=>iFile.click());
  iDrop.addEventListener('keydown',(e)=>{ if(e.key==='Enter'||e.key===' ') iFile.click(); });
  iFile.addEventListener('change',(e)=>loadFile(e.target.files[0]));
  ['dragenter','dragover'].forEach(ev=>iDrop.addEventListener(ev,(e)=>{e.preventDefault(); iDrop.style.borderColor='var(--i-accent)'}));
  ['dragleave','drop'].forEach(ev=>iDrop.addEventListener(ev,(e)=>{e.preventDefault(); iDrop.style.borderColor='var(--i-border)'}));
  iDrop.addEventListener('drop',(e)=>{ const f=e.dataTransfer.files&&e.dataTransfer.files[0]; if(f) loadFile(f); });
  window.addEventListener('paste',(e)=>{ const items=e.clipboardData&&e.clipboardData.items; if(!items)return; for(let i=0;i<items.length;i++){ const it=items[i]; if(it.type.indexOf('image')===0){ loadFile(it.getAsFile()); e.preventDefault(); break; } } });

  document.querySelectorAll('[data-fit]').forEach(btn=>btn.addEventListener('click',()=>{ state.fit = btn.dataset.fit; drawStage(); }));
  const sizeRadios=document.querySelectorAll('input[name="iSizePreset"]'), iSize=$('iSize');
  sizeRadios.forEach(r=>r.addEventListener('change',()=>{ if(r.checked && r.value!=='custom'){ iSize.value=r.value; } setOutSize(); }));
  iSize.addEventListener('input',setOutSize);
  function setOutSize(){ const v=Math.max(128,Math.min(1024,parseInt(iSize.value||'512',10))); state.outSize=v; document.querySelector('input[name="iSizePreset"][value="custom"]').checked=true; drawStage(); }

  $('iRotateLeft').addEventListener('click',()=>{ state.angle=(state.angle-90)%360; drawStage(); });
  $('iRotateRight').addEventListener('click',()=>{ state.angle=(state.angle+90)%360; drawStage(); });
  $('iFlipH').addEventListener('click',()=>{ state.flipH=!state.flipH; drawStage(); });
  $('iFlipV').addEventListener('click',()=>{ state.flipV=!state.flipV; drawStage(); });

  // Crop selection
  const cropSel={active:false,start:null,rect:{x:40,y:40,w:200,h:200}};
  $('iCropMode').addEventListener('click',()=>{ if(!state.srcImg)return; state.cropMode=!state.cropMode; $('iCropMode').textContent=state.cropMode?'Cancel select':'Select area'; drawStage(); });
  $('iApplyCrop').addEventListener('click',()=>{ applyCrop(); });
  function drawCropOverlay(){
    const size=state.outSize;
    ctx.save(); ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fillRect(0,0,size,size);
    if(cropSel.active || cropSel.rect.w>0){
      const r=cropSel.rect; ctx.clearRect(r.x,r.y,r.w,r.h); ctx.strokeStyle='#36c690'; ctx.lineWidth=2; ctx.strokeRect(r.x+.5,r.y+.5,r.w-1,r.h-1);
    }
    ctx.restore();
  }
  function getCanvasPos(e){
    const rect=iCanvas.getBoundingClientRect();
    const cx=(e.touches?e.touches[0].clientX:e.clientX)-rect.left;
    const cy=(e.touches?e.touches[0].clientY:e.clientY)-rect.top;
    const scaleX=iCanvas.width/rect.width, scaleY=iCanvas.height/rect.height;
    return {x:cx*scaleX, y:cy*scaleY};
  }
  function onDown(e){ if(state.lassoActive){ onLassoClick(e); return; } if(!state.cropMode && !state.eraseMode && !state.wandMode) return; if(state.cropMode){ e.preventDefault(); cropSel.active=true; cropSel.start=getCanvasPos(e); cropSel.rect={x:cropSel.start.x,y:cropSel.start.y,w:0,h:0}; drawStage(); } }
  function onMove(e){ if(state.eraseMode){ onEraseMove(e); return; } if(!state.cropMode || !cropSel.active) return; e.preventDefault(); const p=getCanvasPos(e); const x=Math.min(cropSel.start.x,p.x), y=Math.min(cropSel.start.y,p.y), w=Math.abs(p.x-cropSel.start.x), h=Math.abs(p.y-cropSel.start.y); cropSel.rect={x,y,w,h}; drawStage(); }
  function onUp(e){ if(state.eraseMode){ endErase(); return; } if(!state.cropMode||!cropSel.active) return; e.preventDefault(); cropSel.active=false; drawStage(); }
  iCanvas.addEventListener('mousedown',onDown); iCanvas.addEventListener('mousemove',onMove); iCanvas.addEventListener('mouseup',onUp); iCanvas.addEventListener('mouseleave',onUp);
  iCanvas.addEventListener('touchstart',onDown,{passive:false}); iCanvas.addEventListener('touchmove',onMove,{passive:false}); iCanvas.addEventListener('touchend',onUp);

  function applyCrop(){
    if(!state.srcImg) return;
    const sel=cropSel.rect; if(sel.w<5||sel.h<5){ state.cropMode=false; $('iCropMode').textContent='Select area'; drawStage(); return; }
    // Map selection rect to source coords (no rotate/flip by using same math as stageToSource on edges)
    const tl = stageToSource(sel.x, sel.y), br = stageToSource(sel.x+sel.w, sel.y+sel.h);
    if(!tl || !br) { state.cropMode=false; $('iCropMode').textContent='Select area'; drawStage(); return; }
    const nx=Math.floor(Math.min(tl.x, br.x)), ny=Math.floor(Math.min(tl.y, br.y));
    const nw=Math.max(1, Math.floor(Math.abs(br.x - tl.x))), nh=Math.max(1, Math.floor(Math.abs(br.y - tl.y)));
    pushUndo();
    state.crop={x:nx,y:ny,w:nw,h:nh};
    state.cropMode=false; $('iCropMode').textContent='Select area'; drawStage();
  }

  // Background: chroma key + auto-trim
  const iPickColor=$('iPickColor'), iTolerance=$('iTolerance'), iTolVal=$('iTolVal');
  iTolerance.addEventListener('input',()=>iTolVal.textContent=iTolerance.value);
  $('iApplyBG').addEventListener('click',()=>{ if(!state.srcImg) return; pushUndo(); applyRemoveBg(iPickColor.value, parseInt(iTolerance.value,10)); });
  iCanvas.addEventListener('click',(e)=>{ if(!state.srcImg) return;
    if(state.wandMode){ onWandClick(e); return; }
    // pick color 