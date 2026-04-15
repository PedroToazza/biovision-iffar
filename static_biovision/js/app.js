/* ═══════════════════════════════════════════════
   Biovision IFFar — App Logic
   All original functionality preserved + new features
   ═══════════════════════════════════════════════ */

let videoStream;
let lastSelectedFile = null;

// Mapeamento de colunas → rótulos amigáveis
const colLabels = {
  especie: "Espécie",
  imagem: "Imagem",
  reino: "Reino",
  filo: "Filo",
  classe: "Classe",
  ordem: "Ordem",
  familia: "Família",
  genero: "Gênero",
  habitat: "Habitat",
  im_habitat: "Imagem do Habitat",
  morfologia: "Morfologia",
  im_morfologia: "Imagem da Morfologia",
  reproducao: "Reprodução",
  conservacao: "Conservação",
  im_conservacao: "Imagem da Conservação",
  carac_reino: "Características do Reino",
  im_reino: "Imagem do Reino",
  nomes: "Nomes Populares",
  carac_filo: "Características do Filo",
  im_filo: "Imagem do Filo",
  carac_classe: "Características da Classe",
  im_classe: "Imagem da Classe",
  carac_ordem: "Características da Ordem",
  im_ordem: "Imagem da Ordem"
};

const sectionIcons = {};

const $ = (sel) => document.querySelector(sel);

/* ══════════════════════════════
   FORCE TOP
   ══════════════════════════════ */
function forceTop() {
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  requestAnimationFrame(() => window.scrollTo(0, 0));
  setTimeout(() => window.scrollTo(0, 0), 0);
}

// Only force top on identification page
if (document.body.classList.contains('page-identify')) {
  window.addEventListener('load', forceTop);
  window.addEventListener('pageshow', (e) => { if (e.persisted) forceTop(); });
}

/* ══════════════════════════════
   LOADING STATE
   ══════════════════════════════ */
function showLoading(flag) {
  const loading = $("#loading");
  const btnIdentificar = $("#btnIdentificar");
  if (!loading) return;

  loading.style.display = flag ? "block" : "none";
  if (btnIdentificar) btnIdentificar.disabled = !!flag;

  if (flag) startLoadingFacts();
  else stopLoadingFacts();
}

/* ══════════════════════════════
   LOADING FACTS (curiosidades)
   ══════════════════════════════ */
const bioFacts = [];

let factsInterval = null;
function startLoadingFacts() {
  const el = document.getElementById('loadingFacts');
  if (!el) return;
  let idx = Math.floor(Math.random() * bioFacts.length);
  el.style.opacity = '1';
  el.textContent = bioFacts[idx];
  factsInterval = setInterval(() => {
    el.style.opacity = '0';
    setTimeout(() => {
      idx = (idx + 1) % bioFacts.length;
      el.textContent = bioFacts[idx];
      el.style.opacity = '1';
    }, 350);
  }, 3500);
}

function stopLoadingFacts() {
  if (factsInterval) clearInterval(factsInterval);
  factsInterval = null;
  const el = document.getElementById('loadingFacts');
  if (el) { el.textContent = ''; el.style.opacity = '0'; }
}

/* ══════════════════════════════
   IMAGE COMPRESSION
   ══════════════════════════════ */
function dataURLtoBlob(dataUrl) {
  const arr = dataUrl.split(','), mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]); let n = bstr.length; const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new Blob([u8arr], { type: mime });
}

function resizeImageFile(file, maxSize = 1024, quality = 0.9) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = e => { img.src = e.target.result; };
    reader.onerror = reject;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      const scale = Math.min(1, maxSize / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      resolve(dataURLtoBlob(canvas.toDataURL("image/jpeg", quality)));
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ══════════════════════════════
   SEND IMAGE
   ══════════════════════════════ */
async function enviarImagemArquivo(file) {
  const formData = new FormData();
  try {
    const blob = await resizeImageFile(file);
    formData.append("imagem", blob, "upload.jpg");
  } catch {
    formData.append("imagem", file);
  }

  try {
    showLoading(true);
    const resposta = await fetch("/biovision/classificar", { method: "POST", body: formData });
    const dados = await resposta.json();
    exibirResultado(dados);
    incrementCounter();
  } catch (err) {
    exibirResultado({ erro: "Falha ao comunicar com o servidor." });
  } finally {
    showLoading(false);
  }
}

/* ══════════════════════════════
   SMOOTH SCROLL TO TOP
   ══════════════════════════════ */
function scrollToTopEaseOut(duration = 850) {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.scrollTo(0, 0);
    return;
  }

  const startY = window.pageYOffset || document.documentElement.scrollTop || 0;
  if (startY <= 0) return;

  const start = performance.now();
  const easeOutQuint = t => 1 - Math.pow(1 - t, 5);
  let stopped = false;
  const stop = () => { stopped = true; };

  window.addEventListener('wheel', stop, { once: true, passive: true });
  window.addEventListener('touchstart', stop, { once: true, passive: true });
  window.addEventListener('keydown', stop, { once: true });

  function step(now) {
    if (stopped) return;
    const t = Math.min(1, (now - start) / duration);
    window.scrollTo(0, Math.round(startY * (1 - easeOutQuint(t))));
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ══════════════════════════════
   IMAGE PREVIEW
   ══════════════════════════════ */
function mostrarImagem(input) {
  const file = input.files[0];
  if (!file) return;

  lastSelectedFile = file;

  const reader = new FileReader();
  reader.onload = e => {
    $("#previewImagem").src = e.target.result;
    $("#imagemPreview").style.display = "block";

    // Hide dropzone elements
    const dropzone = $("#uploadDropzone");
    if (dropzone) dropzone.style.display = "none";
  };
  reader.readAsDataURL(file);

  $("#btnIdentificar").style.display = "block";
}

/* ══════════════════════════════
   CAMERA (preserved)
   ══════════════════════════════ */
function abrirCamera() {
  const fg = $("#formGaleria");
  const fc = $("#formCamera");
  if (fg) fg.style.display = "none";
  if (fc) fc.style.display = "block";

  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      videoStream = stream;
      const v = $("#video");
      if (v) v.srcObject = stream;
    })
    .catch(err => alert("Erro ao acessar câmera: " + err));
}

function tirarFoto() {
  const video = $("#video");
  if (!video) return;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL("image/png");
  $("#previewImagem").src = dataUrl;
  $("#imagemPreview").style.display = "block";

  canvas.toBlob(blob => {
    lastSelectedFile = blob;
    $("#btnIdentificar").style.display = "block";
  }, "image/png");
}

/* ══════════════════════════════
   BACK TO TOP BUTTON
   ══════════════════════════════ */
function addBackToTopButton() {
  const resultadoDiv = document.getElementById("resultado");
  if (!resultadoDiv) return;

  const old = document.getElementById("toTopContainer");
  if (old) old.remove();

  const wrap = document.createElement("div");
  wrap.id = "toTopContainer";
  wrap.className = "to-top-container";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn-fab";
  btn.setAttribute("aria-label", "Voltar ao topo");
  btn.title = "Voltar ao topo";
  btn.textContent = "↑";
  btn.addEventListener("click", () => scrollToTopEaseOut(900));

  wrap.appendChild(btn);
  resultadoDiv.appendChild(wrap);
}

/* ══════════════════════════════
   GET ICON FOR SECTION
   ══════════════════════════════ */
function getIcon(label) {
  return '';
}

/* ══════════════════════════════
   CHECK IF VALUE HAS REAL CONTENT
   ══════════════════════════════ */
function hasContent(val) {
  if (val === null || val === undefined) return false;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed === '' || trimmed === 'null' || trimmed === 'None' || trimmed === 'N/A') return false;
    return true;
  }
  return Boolean(val);
}

function hasImage(val) {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();
  // A real base64 image has at least ~200 chars (even a tiny 1x1 pixel)
  if (trimmed.length < 200) return false;
  return true;
}

// Auto-detecta formato da imagem pelo header base64
function imgSrc(base64str) {
  if (!base64str) return '';
  if (base64str.startsWith('/9j/')) return 'data:image/jpeg;base64,' + base64str;
  if (base64str.startsWith('iVBOR')) return 'data:image/png;base64,' + base64str;
  if (base64str.startsWith('R0lG')) return 'data:image/gif;base64,' + base64str;
  if (base64str.startsWith('UklG')) return 'data:image/webp;base64,' + base64str;
  return 'data:image/jpeg;base64,' + base64str;
}

/* ══════════════════════════════
   DISPLAY RESULTS
   ══════════════════════════════ */
function exibirResultado(dados) {
  const resultadoDiv = $("#resultado");
  if (!resultadoDiv) return;

  if (dados.erro) {
    resultadoDiv.innerHTML = `<div class="card card-animate"><p style="color:#e53935;font-weight:600;">${dados.erro}</p></div>`;
    return;
  }

  const especie = dados.dados_taxon || {};

  // ─── HEADER CARD: imagem + identificação ───
  const headerImagem = hasImage(especie.imagem)
    ? `<img src="${imgSrc(especie.imagem)}" class="result-header-img" alt="Imagem da espécie"/>`
    : `<div class="result-header-img result-header-noimg">Sem imagem disponível</div>`;

  const nomeCientifico = especie.especie || dados.keyword;
  const nomesPopulares = hasContent(especie.nomes) ? especie.nomes : '';

  const headerHTML = `
    <div class="result-header card-animate">
      <div class="result-header-imgwrap">
        ${headerImagem}
      </div>
      <div class="result-header-info">
        <p class="result-header-label">Espécie identificada</p>
        <h2 class="result-header-name"><i>${nomeCientifico}</i></h2>
        ${nomesPopulares ? `<p class="result-header-popular">${nomesPopulares}</p>` : ''}
        <div class="result-header-confidence">
          <span class="conf-dot"></span>
          ${Number(dados.confidence).toFixed(1)}% de confiança
        </div>
      </div>
    </div>
  `;

  // ─── TABS: monta as abas baseado no que tem dados ───
  const tabs = [];

  // Aba 1: Taxonomia (sempre tenta mostrar)
  const ordemTaxonomia = ["reino", "filo", "classe", "ordem", "familia", "genero", "especie"];
  const taxoItems = [];
  ordemTaxonomia.forEach(chave => {
    if (hasContent(especie[chave])) {
      let valor = especie[chave];
      if (chave === "especie") valor = `<i>${valor}</i>`;
      taxoItems.push(`<div class="taxo-row"><span class="taxo-label">${colLabels[chave]}</span><span class="taxo-value">${valor}</span></div>`);
    }
  });
  if (taxoItems.length) {
    tabs.push({
      id: 'taxonomia',
      label: 'Taxonomia',
      content: `<div class="taxo-grid">${taxoItems.join('')}</div>`
    });
  }

  // Aba 2: Habitat
  const habitatParts = [];
  if (hasContent(especie.habitat)) habitatParts.push(`<p>${especie.habitat}</p>`);
  if (hasImage(especie.im_habitat)) habitatParts.push(`<img src="${imgSrc(especie.im_habitat)}" class="tab-img" alt="Habitat"/>`);
  if (habitatParts.length) {
    tabs.push({ id: 'habitat', label: 'Habitat', content: habitatParts.join('') });
  }

  // Aba 3: Morfologia
  const morfoParts = [];
  if (hasContent(especie.morfologia)) morfoParts.push(`<p>${especie.morfologia}</p>`);
  if (hasImage(especie.im_morfologia)) morfoParts.push(`<img src="${imgSrc(especie.im_morfologia)}" class="tab-img" alt="Morfologia"/>`);
  if (morfoParts.length) {
    tabs.push({ id: 'morfologia', label: 'Morfologia', content: morfoParts.join('') });
  }

  // Aba 4: Reprodução
  if (hasContent(especie.reproducao)) {
    tabs.push({ id: 'reproducao', label: 'Reprodução', content: `<p>${especie.reproducao}</p>` });
  }

  // Aba 5: Conservação
  const consParts = [];
  if (hasContent(especie.conservacao)) consParts.push(`<p>${especie.conservacao}</p>`);
  if (hasImage(especie.im_conservacao)) consParts.push(`<img src="${imgSrc(especie.im_conservacao)}" class="tab-img" alt="Conservação"/>`);
  if (consParts.length) {
    tabs.push({ id: 'conservacao', label: 'Conservação', content: consParts.join('') });
  }

  // Aba 6: Características adicionais (filo, classe, ordem)
  const caracParts = [];
  const caracMap = [
    { chave: 'carac_filo', img: 'im_filo', label: 'Filo' },
    { chave: 'carac_classe', img: 'im_classe', label: 'Classe' },
    { chave: 'carac_ordem', img: 'im_ordem', label: 'Ordem' }
  ];
  caracMap.forEach(c => {
    if (hasContent(especie[c.chave])) {
      caracParts.push(`<h4 class="tab-subhead">${c.label}</h4><p>${especie[c.chave]}</p>`);
      if (hasImage(especie[c.img])) {
        caracParts.push(`<img src="${imgSrc(especie[c.img])}" class="tab-img" alt="${c.label}"/>`);
      }
    }
  });
  if (caracParts.length) {
    tabs.push({ id: 'caracteristicas', label: 'Características', content: caracParts.join('') });
  }

  // Aba 7: Predições (top-k) — se vier do servidor
  if (Array.isArray(dados.topk) && dados.topk.length) {
    const items = dados.topk.map(t => `
      <li>
        <div class="pred-row"><b>${t.label}</b><span>${Number(t.confidence).toFixed(2)}%</span></div>
        <div class="prog"><span style="width:${t.confidence}%;"></span></div>
      </li>
    `).join("");
    tabs.push({
      id: 'predicoes',
      label: 'Predições',
      content: `<ul class="pred-bars">${items}</ul>${dados.aviso ? `<p style="color:#e65100;margin-top:8px;">${dados.aviso}</p>` : ""}`
    });
  }

  // ─── Monta HTML das abas ───
  let tabsHTML = '';
  if (tabs.length) {
    const tabBtns = tabs.map((t, i) =>
      `<button class="tab-btn ${i === 0 ? 'is-active' : ''}" data-tab="${t.id}">${t.label}</button>`
    ).join('');

    const tabPanels = tabs.map((t, i) =>
      `<div class="tab-panel ${i === 0 ? 'is-active' : ''}" data-panel="${t.id}">${t.content}</div>`
    ).join('');

    tabsHTML = `
      <div class="result-tabs card-animate" style="animation-delay:120ms;">
        <div class="tab-bar-wrap">
          <div class="tab-bar">${tabBtns}</div>
        </div>
        <div class="tab-content">${tabPanels}</div>
      </div>
    `;
  }

  // ─── Render ───
  resultadoDiv.innerHTML = headerHTML + tabsHTML;

  // Liga clicks nas abas
  const btns = resultadoDiv.querySelectorAll('.tab-btn');
  const panels = resultadoDiv.querySelectorAll('.tab-panel');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.tab;
      btns.forEach(b => b.classList.toggle('is-active', b === btn));
      panels.forEach(p => p.classList.toggle('is-active', p.dataset.panel === id));
      // Garante que a aba clicada fique visível
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
  });

  // Detecta overflow horizontal pra mostrar/esconder fade nas bordas
  const tabBar = resultadoDiv.querySelector('.tab-bar');
  const tabWrap = resultadoDiv.querySelector('.tab-bar-wrap');
  if (tabBar && tabWrap) {
    const updateOverflow = () => {
      const hasRight = tabBar.scrollLeft + tabBar.clientWidth < tabBar.scrollWidth - 2;
      const hasLeft = tabBar.scrollLeft > 2;
      tabWrap.classList.toggle('has-overflow-right', hasRight);
      tabWrap.classList.toggle('has-overflow-left', hasLeft);
    };
    tabBar.addEventListener('scroll', updateOverflow, { passive: true });
    window.addEventListener('resize', updateOverflow);
    // Roda uma vez depois do render
    setTimeout(updateOverflow, 50);
  }

  // Liga lightbox em todas as imagens (header + abas)
  const headerImg = resultadoDiv.querySelector('.result-header-imgwrap img');
  if (headerImg) {
    headerImg.parentElement.addEventListener('click', () => openLightbox(headerImg.src));
  }
  resultadoDiv.querySelectorAll('.tab-img').forEach(img => {
    img.addEventListener('click', () => openLightbox(img.src));
  });

  // Foco no header pra acessibilidade
  const header = resultadoDiv.querySelector('.result-header');
  if (header) { header.setAttribute('tabindex', '-1'); header.focus(); }

  const btnNova = document.getElementById("btnNova");
  if (btnNova) btnNova.style.display = "block";
}

/* ══════════════════════════════
   IMAGE LIGHTBOX
   ══════════════════════════════ */
function openLightbox(src) {
  let lb = document.getElementById('imgLightbox');
  if (!lb) {
    lb = document.createElement('div');
    lb.id = 'imgLightbox';
    lb.className = 'img-lightbox';
    lb.innerHTML = `
      <button class="img-lightbox-close" aria-label="Fechar">×</button>
      <img src="" alt="Imagem ampliada"/>
    `;
    document.body.appendChild(lb);

    // Click no fundo ou no botão fecha
    lb.addEventListener('click', (e) => {
      if (e.target === lb || e.target.classList.contains('img-lightbox-close')) {
        closeLightbox();
      }
    });

    // ESC fecha
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeLightbox();
    });
  }
  lb.querySelector('img').src = src;
  lb.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  const lb = document.getElementById('imgLightbox');
  if (lb) {
    lb.classList.remove('is-open');
    document.body.style.overflow = '';
  }
}

/* ══════════════════════════════
   COUNTER
   ══════════════════════════════ */
function getCount() {
  try { return parseInt(localStorage.getItem('biovision_count') || '0', 10); }
  catch { return 0; }
}

function incrementCounter() {
  try {
    const c = getCount() + 1;
    localStorage.setItem('biovision_count', c.toString());
    animateCounter(c);
  } catch (e) { }
}

function animateCounter(target) {
  const el = document.getElementById('statCounter');
  if (!el) return;
  const start = parseInt(el.textContent, 10) || 0;
  const diff = target - start;
  if (diff <= 0) { el.textContent = target; return; }
  const duration = 600;
  const t0 = performance.now();
  function tick(now) {
    const p = Math.min(1, (now - t0) / duration);
    el.textContent = Math.round(start + diff * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ══════════════════════════════
   SCROLL REVEAL
   ══════════════════════════════ */
function initScrollReveal() {
  const sections = document.querySelectorAll('.fade-in-section');
  if (!sections.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('is-visible');
    });
  }, { threshold: 0.05, rootMargin: '0px 0px -10px 0px' });

  sections.forEach(s => observer.observe(s));
}

/* ══════════════════════════════
   DRAG & DROP
   ══════════════════════════════ */
function initDragDrop() {
  const box = document.getElementById('uploadBox');
  if (!box) return;

  const prevent = (e) => { e.preventDefault(); e.stopPropagation(); };

  // Also allow clicking the dropzone to select
  const dropzone = document.getElementById('uploadDropzone');
  if (dropzone) {
    dropzone.addEventListener('click', () => {
      document.getElementById('imagem').click();
    });
  }

  box.addEventListener('dragenter', (e) => { prevent(e); box.classList.add('drag-over'); });
  box.addEventListener('dragover', (e) => { prevent(e); box.classList.add('drag-over'); });
  box.addEventListener('dragleave', (e) => { prevent(e); box.classList.remove('drag-over'); });
  box.addEventListener('drop', (e) => {
    prevent(e);
    box.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
      const input = document.getElementById('imagem');
      const dt = new DataTransfer();
      dt.items.add(files[0]);
      input.files = dt.files;
      mostrarImagem(input);
    }
  });
}

/* ══════════════════════════════
   NEW IDENTIFICATION (reset)
   ══════════════════════════════ */
function resetIdentification() {
  lastSelectedFile = null;

  const preview = document.getElementById('imagemPreview');
  if (preview) preview.style.display = 'none';

  const previewImg = document.getElementById('previewImagem');
  if (previewImg) previewImg.src = '';

  const btnId = document.getElementById('btnIdentificar');
  if (btnId) btnId.style.display = 'none';

  const btnNova = document.getElementById('btnNova');
  if (btnNova) btnNova.style.display = 'none';

  const resultado = document.getElementById('resultado');
  if (resultado) resultado.innerHTML = '';

  const dropzone = document.getElementById('uploadDropzone');
  if (dropzone) dropzone.style.display = '';

  const input = document.getElementById('imagem');
  if (input) input.value = '';

  scrollToTopEaseOut(500);
}

/* ══════════════════════════════
   DOMContentLoaded
   ══════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  const zoomModal = document.getElementById("zoomModal");
  const zoomContent = document.getElementById("zoomContent");
  const inputFile = document.getElementById("imagem");
  const btnStart = document.getElementById("btnIdentificar");
  const btnNova = document.getElementById("btnNova");

  if (inputFile) {
    inputFile.addEventListener("change", (e) => mostrarImagem(e.target));
  }

  if (btnStart) {
    btnStart.addEventListener("click", () => {
      if (!lastSelectedFile) {
        alert("Selecione uma imagem primeiro.");
        return;
      }
      enviarImagemArquivo(lastSelectedFile);
    });
  }

  if (btnNova) {
    btnNova.addEventListener("click", resetIdentification);
  }

  // ── Zoom modal (long press) ──
  if (zoomModal && zoomContent) {
    const openZoom = (card) => {
      zoomContent.innerHTML = card.innerHTML;
      zoomModal.style.display = "flex";
      document.body.style.overflow = "hidden";
    };

    const closeZoom = () => {
      zoomModal.style.display = "none";
      zoomContent.innerHTML = "";
      document.body.style.overflow = "auto";
    };

    let pressTimer = null;
    let targetCard = null;

    const startPress = (e) => {
      const card = e.target.closest(".card");
      if (!card) return;
      targetCard = card;
      pressTimer = setTimeout(() => openZoom(targetCard), 150);
    };

    const cancelPress = () => {
      clearTimeout(pressTimer);
      pressTimer = null;
      targetCard = null;
    };

    document.addEventListener("touchstart", startPress);
    document.addEventListener("touchend", cancelPress);
    document.addEventListener("touchmove", cancelPress);
    document.addEventListener("mousedown", startPress);
    document.addEventListener("mouseup", cancelPress);
    document.addEventListener("mouseleave", cancelPress);

    zoomModal.addEventListener("click", (e) => {
      if (e.target === zoomModal) closeZoom();
    });
  }

  // ── Dark Mode Toggle ──
  (function () {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;

    const root = document.documentElement;
    const KEY = 'theme';

    function applyTheme(t) {
      root.dataset.theme = t;
      const to = (t === 'dark') ? 'claro' : 'escuro';
      btn.setAttribute('aria-label', `Alternar para modo ${to}`);
      btn.title = `Alternar para modo ${to}`;
      try { localStorage.setItem(KEY, t); } catch (e) { }
    }

    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) { }
    const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(saved || (systemPrefersDark ? 'dark' : 'light'));

    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        try { if (!localStorage.getItem(KEY)) applyTheme(e.matches ? 'dark' : 'light'); } catch (e2) { }
      });
    }

    btn.addEventListener('click', () => {
      const next = (root.dataset.theme === 'dark') ? 'light' : 'dark';
      applyTheme(next);
      btn.classList.remove('ripple', 'boop');
      void btn.offsetWidth;
      btn.classList.add('ripple', 'boop');
    });
  })();

  // ── Init features ──
  initScrollReveal();
  initDragDrop();
  initScrollProgress();
  initAccordion();
  initNumberCounters();
  initTiltEffect();

  // ── Load counter on any page that has it ──
  const counterEl = document.getElementById('statCounter');
  if (counterEl) counterEl.textContent = getCount();
});

/* ══════════════════════════════
   SCROLL PROGRESS BAR
   ══════════════════════════════ */
function initScrollProgress() {
  const bar = document.getElementById('scrollProgress');
  if (!bar) return;

  window.addEventListener('scroll', () => {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    if (h <= 0) return;
    bar.style.width = (window.scrollY / h * 100) + '%';
  }, { passive: true });
}

/* ══════════════════════════════
   ACCORDION
   ══════════════════════════════ */
function initAccordion() {
  const items = document.querySelectorAll('.acc-item');
  if (!items.length) return;

  items.forEach(item => {
    const trigger = item.querySelector('.acc-trigger');
    if (!trigger) return;

    trigger.addEventListener('click', () => {
      const isOpen = item.classList.contains('is-open');

      // Close all
      items.forEach(i => {
        i.classList.remove('is-open');
        const t = i.querySelector('.acc-trigger');
        if (t) t.setAttribute('aria-expanded', 'false');
      });

      // Open clicked (if it was closed)
      if (!isOpen) {
        item.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });
  });
}

/* ══════════════════════════════
   NUMBER COUNTER ON SCROLL
   ══════════════════════════════ */
function initNumberCounters() {
  const cards = document.querySelectorAll('.number-value[data-count]');
  if (!cards.length) return;

  let animated = false;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !animated) {
        animated = true;
        cards.forEach(el => {
          const target = parseInt(el.dataset.count, 10);
          const duration = 1200;
          const t0 = performance.now();
          const easeOut = t => 1 - Math.pow(1 - t, 4);

          function tick(now) {
            const p = Math.min(1, (now - t0) / duration);
            el.textContent = Math.round(target * easeOut(p));
            if (p < 1) requestAnimationFrame(tick);
          }
          requestAnimationFrame(tick);
        });
      }
    });
  }, { threshold: 0.3 });

  const section = document.querySelector('.numbers-section');
  if (section) observer.observe(section);
}

/* ══════════════════════════════
   TILT EFFECT ON CARDS
   ══════════════════════════════ */
function initTiltEffect() {
  const cards = document.querySelectorAll('[data-tilt]');
  if (!cards.length) return;
  if (window.matchMedia('(hover: none)').matches) return; // skip touch devices

  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(600px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateY(-4px)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
}
