/*! (c) TheBukitBesi.com — Protected build (domain-locked) */
(function(w,d){
try{
var host=(w.location&&w.location.hostname||"").toLowerCase().replace(/^www./,'');
var allow=["thebukitbesi.com","localhost","127.0.0.1"];
var ok=false; for(var i=0;i<allow.length;i++){var dom=allow[i]; if(host===dom||host.endsWith("."+dom)){ok=true;break;}}
if(!ok){ return; }// Only run if container exists (prevents errors if embedded elsewhere)
if(!d.getElementById("iw-wrap") && !d.querySelector(".iw-wrap")) return;

(function(){
  // Utilities
  const $ = (sel, ctx=document) => ctx.querySelector(sel);
  const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
  const encode = s => encodeURIComponent(s || "");

  function normalizeMY(numRaw){
    if(!numRaw) return "";
    let x = (""+numRaw).trim().replace(/[^\d+]/g, "");
    if(x.startsWith("+")) x = x.slice(1);
    if(x.startsWith("00")) x = x.slice(2);
    x = x.replace(/[^\d]/g,"");
    if(x.startsWith("60")){
      if(x[2]==="0") x = "60" + x.slice(3);
    } else if(x.startsWith("0")) {
      x = "60" + x.slice(1);
    } else if(x.length>=9 && x.length<=11) {
      x = "60" + x;
    }
    return x.replace(/[^\d]/g,"");
  }

  function isLikelyMY(num){
    if(!num || !/^\d+$/.test(num)) return false;
    if(!num.startsWith("60")) return false;
    const local = num.slice(2);
    return local.length>=8 && local.length<=11;
  }

  function buildMessage(template, vars){
    if(!template) return "";
    return template.replace(/\{(\w+)\}/g, (_,k) => {
      const key = (k||"").toLowerCase();
      return (vars && vars[key]) ? vars[key] : `{${k}}`;
    });
  }

  function buildLinks(phone, message){
    const text = encode(message);
    const wa = `https://wa.me/${phone}${text ? ("?text=" + text) : ""}`;
    const api = `https://api.whatsapp.com/send?phone=${phone}${text ? ("&text=" + text) : ""}`;
    return {wa, api};
  }

  function copyToClipboard(text){
    if(navigator.clipboard && window.isSecureContext){
      return navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position="fixed"; ta.style.opacity="0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } finally { document.body.removeChild(ta); }
      return Promise.resolve();
    }
  }

  // Tabs
  $$(".ibtn-tab").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      $$(".ibtn-tab").forEach(b=>{ b.classList.remove("active"); b.setAttribute("aria-selected","false"); });
      btn.classList.add("active"); btn.setAttribute("aria-selected","true");
      const id = btn.dataset.tab;
      $$(".iw-card").forEach(c=>c.classList.add("iw-hidden"));
      $("#"+id).classList.remove("iw-hidden");
    });
  });

  // Tool 1 elements
  const elPhone = $("#iw-phone");
  const elMsg = $("#iw-message");
  const elPrefer = $("#iw-prefer");
  const elNama = $("#iw-nama");
  const elProduk = $("#iw-produk");
  const elKod = $("#iw-kod");
  const btnBuild = $("#iw-build");
  const btnTest = $("#iw-test");
  const btnCopy = $("#iw-copy");
  const outWa = $("#iw-out-wa");
  const outApi = $("#iw-out-api");

  const btnLabel = $("#iw-btnlabel");
  const selStyle = $("#iw-style");
  const outHtml = $("#iw-html");
  const btnCopyHtml = $("#iw-copyhtml");

  // Template dropdown
  const selTmpl = $("#iw-tmpl");
  if(selTmpl && elMsg){
    selTmpl.addEventListener("change", function(){
      if(!this.value) return;
      if(!elMsg.value) { elMsg.value = this.value; }
      else { elMsg.value = (elMsg.value.trim() + "\n" + this.value).trim(); }
    });
  }

  // Persist local values
  try {
    const saved = JSON.parse(localStorage.getItem("iw_my_last")||"{}");
    if(saved.phone && elPhone) elPhone.value = saved.phone;
    if(saved.msg && elMsg) elMsg.value = saved.msg;
  } catch(e){}

  function runBuild(){
    if(!elPhone || !outWa || !outApi) return;
    const phone = normalizeMY(elPhone.value);
    const vars = {
      nama: (elNama && elNama.value||"").trim(),
      produk: (elProduk && elProduk.value||"").trim(),
      kod: (elKod && elKod.value||"").trim(),
      tarikh: new Date().toLocaleDateString("ms-MY"),
      masa: new Date().toLocaleTimeString("ms-MY",{hour:"2-digit", minute:"2-digit"})
    };
    let msg = buildMessage(elMsg ? elMsg.value : "", vars);

    if(!phone || !isLikelyMY(phone)){
      outWa.value = ""; outApi.value = "";
      if(btnTest) btnTest.disabled = true;
      if(btnCopy) btnCopy.disabled = true;
      if(btnCopyHtml) btnCopyHtml.disabled = true;
      if(outHtml) outHtml.value = "";
      alert("Sila semak nombor Malaysia anda. Contoh: 0171234567 atau +60171234567");
      return;
    }

    const links = buildLinks(phone, msg);
    outWa.value = links.wa;
    outApi.value = links.api;
    if(btnTest) btnTest.disabled = false;
    if(btnCopy) btnCopy.disabled = false;

    // HTML button snippet
    const final = (elPrefer && elPrefer.value==="api") ? links.api : links.wa;
    const label = btnLabel && btnLabel.value ? btnLabel.value : "Chat di WhatsApp";
    let cls = "ibutton ibtn-whatsapp";
    if(selStyle && selStyle.value==="fill"){ cls+=" ibtn-fill"; }
    else if(selStyle && selStyle.value==="outline"){ cls+=" ibtn-outline"; }
    else { cls+=" ibtn-link"; }
    const html = `<!-- Built with TheBukitBesi WhatsApp Tool -->
    <a href="${final}" class="${cls}" target="_blank" rel="nofollow noopener" aria-label="WhatsApp"><span>${label}</span></a>`;
if(outHtml) outHtml.value = html;
if(btnCopyHtml) btnCopyHtml.disabled = false;    try { localStorage.setItem("iw_my_last", JSON.stringify({phone: elPhone.value, msg: elMsg?elMsg.value:""})); } catch(e){}
  }

  if(btnBuild) btnBuild.addEventListener("click", runBuild);
  if(btnTest) btnTest.addEventListener("click", ()=>{
    const prefer = elPrefer ? elPrefer.value : "wa";
    const url = prefer==="api" ? (outApi ? outApi.value : "") : (outWa ? outWa.value : "");
    if(url) window.open(url, "_blank", "noopener");
  });
  if(btnCopy) btnCopy.addEventListener("click", ()=>{
    const prefer = elPrefer ? elPrefer.value : "wa";
    const url = prefer==="api" ? (outApi ? outApi.value : "") : (outWa ? outWa.value : "");
    if(!url) return;
    copyToClipboard(url).then(()=>{ btnCopy.textContent="Disalin!"; setTimeout(()=>btnCopy.textContent="Salin Pautan",1200); });
  });
  if(btnCopyHtml) btnCopyHtml.addEventListener("click", ()=>{
    if(!outHtml || !outHtml.value) return;
    copyToClipboard(outHtml.value).then(()=>{ btnCopyHtml.textContent="Disalin!"; setTimeout(()=>btnCopyHtml.textContent="Salin Kod HTML",1200); });
  });

  // Minimal CSS for generated button (scoped)
  const styleEl = document.createElement("style");
  styleEl.textContent = `.ibutton.ibtn-whatsapp{display:inline-flex;gap:.5rem;align-items:center;text-decoration:none;border-radius:12px;padding:.65rem .9rem;}.ibutton.ibtn-whatsapp.ibtn-fill{background:#25D366;color:#fff;}
.ibutton.ibtn-whatsapp.ibtn-outline{border:2px solid #25D366;color:#25D366;background:transparent;}
.ibutton.ibtn-whatsapp.ibtn-link{background:none;color:#25D366;padding:0;}
.ibutton.ibtn-whatsapp:hover{filter:brightness(.95);}`;
document.head.appendChild(styleEl);  // Tool 2: QR
  const elQrLink = $("#iw-qr-link");
  const elQrSize = $("#iw-qr-size");
  const elQrLevel = $("#iw-qr-level");
  const btnQrBuild = $("#iw-qr-build");
  const btnQrDl = $("#iw-qr-dl");
  const qrPreview = $("#iw-qr-preview");
  let qrInstance = null;

  function ensureQRCodeLib(){ return typeof QRCode !== "undefined"; }

  if(btnQrBuild) btnQrBuild.addEventListener("click", ()=>{
    const link = (elQrLink && elQrLink.value||"").trim();
    if(!link || !/^https?:\/\//i.test(link)) { alert("Tampal pautan WhatsApp yang sah (http/https)."); return; }
    if(!ensureQRCodeLib()){
      alert("Sila muatkan fail qrcode.min.js (rujuk arahan halaman).");
      return;
    }
    if(qrPreview) qrPreview.innerHTML = "";
    qrInstance = new QRCode(qrPreview, {
      text: link,
      width: Number(elQrSize && elQrSize.value)||240,
      height: Number(elQrSize && elQrSize.value)||240,
      correctLevel: (QRCode.CorrectLevel[elQrLevel && elQrLevel.value] || QRCode.CorrectLevel.M)
    });
    if(btnQrDl) setTimeout(()=>{ btnQrDl.disabled = false; }, 300);
  });

  if(btnQrDl) btnQrDl.addEventListener("click", ()=>{
    if(!qrInstance || !qrPreview) return;
    const canvas = qrPreview.querySelector("canvas");
    let dataURL = null;
    if(canvas){ dataURL = canvas.toDataURL("image/png"); }
    else {
      const img = qrPreview.querySelector("img");
      if(img) dataURL = img.src;
    }
    if(!dataURL){ alert("Tidak dapat menjana fail PNG. Cuba jana semula."); return; }
    const a = document.createElement("a");
    a.href = dataURL; a.download = "whatsapp-qr.png";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  });

  // Tool 3: Bulk
  const elBulkNums = $("#iw-bulk-nums");
  const elBulkMsg = $("#iw-bulk-msg");
  const btnBulk = $("#iw-bulk-build");
  const btnBulkCopy = $("#iw-bulk-copy");
  const btnBulkCsv = $("#iw-bulk-csv");
  const tblBody = $("#iw-bulk-table tbody");

  function parseNumbers(raw){
    if(!raw) return [];
    const parts = raw.split(/[\s,;]+/).map(s=>s.trim()).filter(Boolean);
    const seen = new Set();
    const out = [];
    for(const p of parts){
      const norm = normalizeMY(p);
      if(!norm) continue;
      if(seen.has(norm)) continue;
      seen.add(norm);
      out.push(norm);
    }
    return out;
  }

  function exportCSV(rows){
    const head = ["index","phone","wa","api"];
    const lines = [head.join(",")];
    rows.forEach((r,i)=>{
      lines.push([i+1, r.phone, r.wa, r.api].map(v=>`"${(v||"").replace(/"/g,'""')}"`).join(","));
    });
    const blob = new Blob([lines.join("\n")], {type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "whatsapp-bulk.csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if(btnBulk) btnBulk.addEventListener("click", ()=>{
    if(!tblBody) return;
    const nums = parseNumbers(elBulkNums ? elBulkNums.value : "");
    const msgTmpl = elBulkMsg ? elBulkMsg.value : "";
    const rows = [];
    tblBody.innerHTML = "";
    if(nums.length===0){
      alert("Tiada nombor ditemui.");
      if(btnBulkCopy) btnBulkCopy.disabled = true;
      if(btnBulkCsv) btnBulkCsv.disabled=true;
      return;
    }

    nums.forEach((n, idx)=>{
      const valid = isLikelyMY(n);
      const msg = buildMessage(msgTmpl, {});
      const links = valid ? buildLinks(n, msg) : {wa:"", api:""};
      rows.push({phone:n, wa:links.wa, api:links.api, valid});

      const tr = document.createElement("tr");
      function td(label, html){
        const c = document.createElement("td");
        c.setAttribute("data-label", label);
        c.innerHTML = html;
        return c;
      }
      tr.appendChild(td("#", String(idx+1)));
      tr.appendChild(td("Nombor", valid ? `<span class="iw-good">${n}</span>` : `<span class="iw-bad">${n}</span>`));
      tr.appendChild(td("wa.me", valid ? `<a href="${links.wa}" target="_blank" rel="noopener">Buka</a>` : "-"));
      tr.appendChild(td("api", valid ? `<a href="${links.api}" target="_blank" rel="noopener">Buka</a>` : "-"));
      tr.appendChild(td("Tindakan", valid ? `<button class="ibtn iw-copy-one" data-url="${links.wa}">Salin</button>` : "-"));
      tblBody.appendChild(tr);
    });

    const anyValid = rows.some(r=>r.valid);
    if(btnBulkCopy) btnBulkCopy.disabled = !anyValid;
    if(btnBulkCsv) btnBulkCsv.disabled = !anyValid;

    $$(".iw-copy-one", tblBody).forEach(b=>{
      b.addEventListener("click", ()=>{
        const url = b.getAttribute("data-url");
        if(!url) return;
        copyToClipboard(url).then(()=>{ b.textContent="Disalin!"; setTimeout(()=>b.textContent="Salin",1200); });
      });
    });

    if(btnBulkCopy) btnBulkCopy._rows = rows.filter(r=>r.valid);
    if(btnBulkCsv) btnBulkCsv._rows = rows.filter(r=>r.valid);
  });

  if(btnBulkCopy) btnBulkCopy.addEventListener("click", ()=>{
    const rows = btnBulkCopy._rows || [];
    if(rows.length===0) return;
    const text = rows.map(r=>r.wa).join("\n");
    copyToClipboard(text).then(()=>{ btnBulkCopy.textContent="Disalin!"; setTimeout(()=>btnBulkCopy.textContent="Salin Semua",1200); });
  });
  if(btnBulkCsv) btnBulkCsv.addEventListener("click", ()=>{
    const rows = btnBulkCsv._rows || [];
    if(rows.length===0) return;
    exportCSV(rows);
  });
})();}catch(e){}
})(window,document);
