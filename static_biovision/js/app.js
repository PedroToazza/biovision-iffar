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
   DISPLAY RESULTS
   ══════════════════════════════ */
function exibirResultado(dados) {
  const resultadoDiv = $("#resultado");
  if (!resultadoDiv) return;

  if (dados.erro) {
    resultadoDiv.innerHTML = `<div class="card card-animate"><p style="color:#e53935;font-weight:600;">${dados.erro}</p></div>`;
    return;
  }

  const especie = dados.dados_taxon;
  const cards = [];

  // Imagem da espécie
  if (especie && especie.imagem) {
    cards.push(`
      <div class="card">
        <h3>${getIcon("Imagem da Espécie")} Imagem da Espécie</h3>
        <img src="data:image/jpeg;base64,${especie.imagem}" class="result-img" alt="Imagem da espécie"/>
        ${especie.especie ? `<p style="text-align:center;margin-top:8px;"><i>${especie.especie}</i></p>` : ""}
      </div>
    `);
  }

  // Resultado
  cards.push(`
    <div class="card">
      <h2>${getIcon("Resultado da Classificação")} Resultado da Classificação</h2>
      <p><b>Classe Prevista:</b> ${dados.keyword}</p>
      <p><b>Confiança:</b> ${Number(dados.confidence).toFixed(2)}%</p>
    </div>
  `);

  // Nomes populares
  if (especie && especie.nomes) {
    cards.push(`
      <div class="card">
        <h3>${getIcon("Nomes Populares")} ${colLabels["nomes"]}</h3>
        <p>${especie.nomes}</p>
      </div>
    `);
  }

  // Taxonomia
  if (especie) {
    const ordemTaxonomia = ["reino", "filo", "classe", "ordem", "familia", "genero", "especie"];
    let taxoList = "";
    ordemTaxonomia.forEach(chave => {
      if (especie[chave]) {
        let valor = especie[chave];
        if (chave === "especie") valor = `<i>${valor}</i>`;
        taxoList += `<li><b>${colLabels[chave]}:</b> ${valor}</li>`;
      }
    });
    if (taxoList) {
      cards.push(`
        <div class="card">
          <h3>${getIcon("Taxonomia")} Taxonomia</h3>
          <ul>${taxoList}</ul>
        </div>
      `);
    }
  }

  // Restante das colunas
  if (especie) {
    const ignorar = new Set(["reino", "filo", "classe", "ordem", "familia", "genero", "especie", "nomes", "imagem", "carac_reino"]);
    for (const chave in especie) {
      if (chave === "carac_reino") continue;
      if (!ignorar.has(chave) && especie[chave]) {
        const label = colLabels[chave] || chave;
        const icon = getIcon(label);
        if (chave.startsWith("im_")) {
          cards.push(`
            <div class="card">
              <h3>${icon} ${label}</h3>
              <img src="data:image/jpeg;base64,${especie[chave]}" class="result-img" alt="${label}"/>
            </div>
          `);
        } else {
          cards.push(`
            <div class="card">
              <h3>${icon} ${label}</h3>
              <p>${especie[chave]}</p>
            </div>
          `);
        }
      }
    }
  }

  // Predições (top-k)
  if (Array.isArray(dados.topk) && dados.topk.length) {
    const items = dados.topk.map(t => `
      <li>
        <b>${t.label}</b> — ${Number(t.confidence).toFixed(2)}%
        <div class="prog"><span style="width:${t.confidence}%;"></span></div>
      </li>
    `).join("");
    cards.push(`
      <div class="card">
        <h3>${getIcon("Predições")} Predições</h3>
        <ul class="pred-bars">${items}</ul>
        ${dados.aviso ? `<p style="color:#e65100;margin-top:8px;">${dados.aviso}</p>` : ""}
      </div>
    `);
  }

  // Render com stagger
  resultadoDiv.innerHTML = "";
  const frag = document.createDocumentFragment();

  cards.forEach((html, i) => {
    const tpl = document.createElement("template");
    tpl.innerHTML = html.trim();
    const el = tpl.content.firstElementChild;
    el.classList.add("card-animate");
    el.style.animationDelay = `${i * 100}ms`;
    frag.appendChild(el);
  });

  resultadoDiv.appendChild(frag);

  const firstCard = resultadoDiv.querySelector(".card");
  if (firstCard) { firstCard.setAttribute("tabindex", "-1"); firstCard.focus(); }

  addBackToTopButton();

  // Show "Nova identificação" button
  const btnNova = document.getElementById("btnNova");
  if (btnNova) btnNova.style.display = "block";
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
