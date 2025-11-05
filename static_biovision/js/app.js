let videoStream;
let lastSelectedFile = null;

// 🔹 Mapeamento de colunas → rótulos amigáveis
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

const $ = (sel) => document.querySelector(sel);

// Sempre abrir no topo
function forceTop(){
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  requestAnimationFrame(() => window.scrollTo(0,0));
  setTimeout(() => window.scrollTo(0,0), 0);
}
window.addEventListener('load', forceTop);
window.addEventListener('pageshow', (e) => { if (e.persisted) forceTop(); });

function showLoading(flag) {
  const loading = $("#loading");
  const btnIdentificar = $("#btnIdentificar");
  if (!loading) return;

  loading.style.display = flag ? "block" : "none";
  if (btnIdentificar) btnIdentificar.disabled = !!flag;
}

async function enviarImagemArquivo(file) {
  const formData = new FormData();
  formData.append("imagem", file);

  try {
    showLoading(true);
    const resposta = await fetch("/biovision/classificar", {
      method: "POST",
      body: formData
    });
    const dados = await resposta.json();
    exibirResultado(dados);
  } catch (err) {
    exibirResultado({ erro: "Falha ao comunicar com o servidor." });
  } finally {
    showLoading(false);
  }
}

// Rolagem customizada: começa rápido e desacelera no final (easeOutQuint)
function scrollToTopEaseOut(duration = 850) {
  // respeita usuários que preferem menos animação
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.scrollTo(0, 0);
    return;
  }

  const startY = window.pageYOffset || document.documentElement.scrollTop || 0;
  if (startY <= 0) return;

  const start = performance.now();
  // easeOutQuint: 1 - (1 - t)^5  → acelera no início, desacelera forte no final
  const easeOutQuint = t => 1 - Math.pow(1 - t, 5);

  let stopped = false;
  const stop = () => { stopped = true; };

  // se o usuário interagir, cancela a animação
  window.addEventListener('wheel', stop, { once: true, passive: true });
  window.addEventListener('touchstart', stop, { once: true, passive: true });
  window.addEventListener('keydown', stop, { once: true });

  function step(now) {
    if (stopped) return;
    const t = Math.min(1, (now - start) / duration);
    const eased = easeOutQuint(t);
    const y = Math.round(startY * (1 - eased));
    window.scrollTo(0, y);
    if (t < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

function mostrarImagem(input) {
  const file = input.files[0];
  if (!file) return;

  lastSelectedFile = file;

  const reader = new FileReader();
  reader.onload = e => {
    $("#previewImagem").src = e.target.result;
    $("#imagemPreview").style.display = "block";
  };
  reader.readAsDataURL(file);

  // Agora NÃO envia automaticamente. Mostra o botão de iniciar.
  $("#btnIdentificar").style.display = "block";
}

function abrirCamera() {
  $("#formGaleria").style.display = "none";
  $("#formCamera").style.display = "block";

  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      videoStream = stream;
      $("#video").srcObject = stream;
    })
    .catch(err => alert("Erro ao acessar câmera: " + err));
}

function tirarFoto() {
  const video = $("#video");
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL("image/png");
  $("#previewImagem").src = dataUrl;
  $("#imagemPreview").style.display = "block";

  // NÃO envia ainda; guarda e mostra o botão "Iniciar identificação"
  canvas.toBlob(blob => {
    lastSelectedFile = blob;
    $("#btnIdentificar").style.display = "block";
  }, "image/png");
}
function addBackToTopButton() {
  const resultadoDiv = document.getElementById("resultado");

  // remove anterior (se existir) para não duplicar
  const old = document.getElementById("toTopContainer");
  if (old) old.remove();

  // cria container + botão
  const wrap = document.createElement("div");
  wrap.id = "toTopContainer";
  wrap.className = "to-top-container";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn-fab";
  btn.setAttribute("aria-label", "Voltar ao topo");
  btn.title = "Voltar ao topo";
  btn.textContent = "↑"; // pode trocar por "⤴" ou "⇧" se preferir

btn.addEventListener("click", () => {
  scrollToTopEaseOut(900);  // ajuste a duração (ms) se quiser mais/menos “longa”
});

  wrap.appendChild(btn);
  resultadoDiv.appendChild(wrap);
}

function exibirResultado(dados) {
  const resultadoDiv = $("#resultado");

  if (dados.erro) {
    resultadoDiv.innerHTML = `<div class="card card-animate"><p style="color:red;">${dados.erro}</p></div>`;
    return;
  }

  const especie = dados.dados_taxon;
  const cards = [];

  // 👉 Imagem da espécie (logo abaixo da selecionada)
  if (especie && especie.imagem) {
    cards.push(`
      <div class="card">
        <h3>Imagem da Espécie</h3>
        <img src="data:image/jpeg;base64,${especie.imagem}" class="result-img" alt="Imagem da espécie"/>
        ${especie.especie ? `<p><i>${especie.especie}</i></p>` : ""}
      </div>
    `);
  }

  // 👉 Resultado da classificação
  cards.push(`
    <div class="card">
      <h2>Resultado da Classificação</h2>
      <p><b>Classe Prevista:</b> ${dados.keyword}</p>
      <p><b>Confiança:</b> ${Number(dados.confidence).toFixed(2)}%</p>
    </div>
  `);

  // 👉 Nomes populares
  if (especie && especie.nomes) {
    cards.push(`
      <div class="card">
        <h3>${colLabels["nomes"]}</h3>
        <p>${especie.nomes}</p>
      </div>
    `);
  }

  // 👉 Taxonomia fixa
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
          <h3>Taxonomia</h3>
          <ul>${taxoList}</ul>
        </div>
      `);
    }
  }

  // 👉 Restante das colunas (exceto taxonomia e nomes)
  if (especie) {
    const ignorar = new Set(["reino","filo","classe","ordem","familia","genero","especie","nomes","imagem"]);
    for (const chave in especie) {
      if (!ignorar.has(chave) && especie[chave]) {
        const label = colLabels[chave] || chave;
        if (chave.startsWith("im_")) {
          cards.push(`
            <div class="card">
              <h3>${label}</h3>
              <img src="data:image/jpeg;base64,${especie[chave]}" class="result-img" alt="${label}"/>
            </div>
          `);
        } else {
          cards.push(`
            <div class="card">
              <h3>${label}</h3>
              <p>${especie[chave]}</p>
            </div>
          `);
        }
      }
    }
  }

  // Render com animação suave e escalonada (stagger)
  resultadoDiv.innerHTML = "";
  const frag = document.createDocumentFragment();

  cards.forEach((html, i) => {
    const tpl = document.createElement("template");
    tpl.innerHTML = html.trim();
    const el = tpl.content.firstElementChild;
    el.classList.add("card-animate");
    el.style.animationDelay = `${i * 80}ms`; // 0.08s de intervalo entre cards
    frag.appendChild(el);
  });

  resultadoDiv.appendChild(frag);

  // foco acessível no primeiro card (se você já colocou)
const firstCard = resultadoDiv.querySelector(".card");
if (firstCard) { firstCard.setAttribute("tabindex","-1"); firstCard.focus(); }

// adiciona o botão "voltar ao topo"
addBackToTopButton();

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
      <h3>Predições</h3>
      <ul class="pred-bars">${items}</ul>
      ${dados.aviso ? `<p style="color:#e65100;margin-top:6px;">${dados.aviso}</p>` : ""}
    </div>
  `);
}

}

// === Zoom modal com long press ===
document.addEventListener("DOMContentLoaded", () => {
  const zoomModal   = document.getElementById("zoomModal");
  const zoomContent = document.getElementById("zoomContent");
  const inputFile   = document.getElementById("imagem");
  const btnStart    = document.getElementById("btnIdentificar");

  if (inputFile) {
    inputFile.addEventListener("change", (e) => {
      mostrarImagem(e.target);
    });
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

  if (!zoomModal || !zoomContent) return;

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

  // Long press
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

  // Fechar clicando no fundo
  zoomModal.addEventListener("click", (e) => {
    if (e.target === zoomModal) {
      closeZoom();
    }
  });
function dataURLtoBlob(dataUrl) {
  const arr = dataUrl.split(','), mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]); let n = bstr.length; const u8arr = new Uint8Array(n);
  while(n--) u8arr[n] = bstr.charCodeAt(n);
  return new Blob([u8arr], {type:mime});
}

function resizeImageFile(file, maxSize=1024, quality=0.9) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = e => { img.src = e.target.result; };
    reader.onerror = reject;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      const scale = Math.min(1, maxSize / Math.max(width, height));
      width = Math.round(width * scale); height = Math.round(height * scale);
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      resolve(dataURLtoBlob(dataUrl));
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function enviarImagemArquivo(file) {
  const formData = new FormData();
  try {
    // 🔸 comprime para acelerar upload/CPU do servidor
    const blob = await resizeImageFile(file);
    formData.append("imagem", blob, "upload.jpg");
  } catch {
    formData.append("imagem", file); // fallback
  }

  try {
    showLoading(true);
    const resposta = await fetch("/biovision/classificar", { method: "POST", body: formData });
    const dados = await resposta.json();
    exibirResultado(dados);
  } catch (err) {
    exibirResultado({ erro: "Falha ao comunicar com o servidor." });
  } finally {
    showLoading(false);
  }
}

// === Dark Mode Toggle ===
(function(){
  const btn = document.getElementById('themeToggle');
  if (!btn) return;

  const root = document.documentElement;
  const KEY = 'theme';

  function applyTheme(t){
    root.dataset.theme = t;
    // atualiza acessibilidade/tooltip
    const to = (t === 'dark') ? 'claro' : 'escuro';
    btn.setAttribute('aria-label', `Alternar para modo ${to}`);
    btn.title = `Alternar para modo ${to}`;
    try { localStorage.setItem(KEY, t); } catch(e){}
  }

  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch(e){}
  const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (systemPrefersDark ? 'dark' : 'light'));

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      const current = localStorage.getItem(KEY);
      if (!current) applyTheme(e.matches ? 'dark' : 'light');
    });
  }

  btn.addEventListener('click', () => {
    const next = (root.dataset.theme === 'dark') ? 'light' : 'dark';
    applyTheme(next);

    // dispara ripple + boop (remove e readiciona para reiniciar animação)
    btn.classList.remove('ripple','boop');
    // força reflow
    void btn.offsetWidth;
    btn.classList.add('ripple','boop');
  });
})();




});
