let videoStream;

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

async function enviarImagemArquivo(file) {
    const formData = new FormData();
    formData.append("imagem", file);

    const resposta = await fetch("/classificar", {
        method: "POST",
        body: formData
    });
    const dados = await resposta.json();
    exibirResultado(dados);
}

function mostrarImagem(input) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = e => {
            document.getElementById("previewImagem").src = e.target.result;
            document.getElementById("imagemPreview").style.display = "block";
        };
        reader.readAsDataURL(file);

        enviarImagemArquivo(file); // envia logo depois de escolher
    }
}

function abrirCamera() {
    document.getElementById("formGaleria").style.display = "none";
    document.getElementById("formCamera").style.display = "block";

    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            videoStream = stream;
            document.getElementById("video").srcObject = stream;
        })
        .catch(err => alert("Erro ao acessar câmera: " + err));
}

function tirarFoto() {
    const video = document.getElementById("video");
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/png");
    document.getElementById("previewImagem").src = dataUrl;
    document.getElementById("imagemPreview").style.display = "block";

    canvas.toBlob(blob => {
        enviarImagemArquivo(blob);
    }, "image/png");
}

function exibirResultado(dados) {
    const resultadoDiv = document.getElementById("resultado");

    if (dados.erro) {
        resultadoDiv.innerHTML = `<p style="color:red;">${dados.erro}</p>`;
        return;
    }

    const especie = dados.dados_taxon;
    let html = "";

    // 👉 Imagem da espécie (logo abaixo da selecionada)
    if (especie.imagem) {
        html += `
            <div class="card">
                <h3>Imagem da Espécie</h3>
                <img src="data:image/jpeg;base64,${especie.imagem}" class="result-img"/>
                ${especie.especie ? `<p><i>${especie.especie}</i></p>` : ""}
            </div>
        `;
    }

    // 👉 Resultado da classificação
    html += `
        <div class="card">
            <h2>Resultado da Classificação</h2>
            <p><b>Classe Prevista:</b> ${dados.keyword}</p>
            <p><b>Confiança:</b> ${dados.confidence.toFixed(2)}%</p>
        </div>
    `;

    // 👉 Nomes populares
    if (especie.nomes) {
        html += `
            <div class="card">
                <h3>${colLabels["nomes"]}</h3>
                <p>${especie.nomes}</p>
            </div>
        `;
    }

    // 👉 Taxonomia fixa
    const ordemTaxonomia = ["reino", "filo", "classe", "ordem", "familia", "genero", "especie"];
    html += `<div class="card"><h3>Taxonomia</h3><ul>`;
    ordemTaxonomia.forEach(chave => {
        if (especie[chave]) {
            let valor = especie[chave];
            if (chave === "especie") {
                valor = `<i>${valor}</i>`; // itálico para nome científico
            }
            html += `<li><b>${colLabels[chave]}:</b> ${valor}</li>`;
        }
    });
    html += `</ul></div>`;

    // 👉 Restante das colunas (exceto taxonomia e nomes)
    const ignorar = new Set([...ordemTaxonomia, "nomes", "imagem"]);
    for (const chave in especie) {
        if (!ignorar.has(chave) && especie[chave]) {
            const label = colLabels[chave] || chave;
            if (chave.startsWith("im_")) {
                html += `
                    <div class="card">
                        <h3>${label}</h3>
                        <img src="data:image/jpeg;base64,${especie[chave]}" class="result-img"/>
                    </div>
                `;
            } else {
                html += `
                    <div class="card">
                        <h3>${label}</h3>
                        <p>${especie[chave]}</p>
                    </div>
                `;
            }
        }
    }

    resultadoDiv.innerHTML = html;
}

// === Zoom modal com long press ===
document.addEventListener("DOMContentLoaded", () => {
  const zoomModal   = document.getElementById("zoomModal");
  const zoomContent = document.getElementById("zoomContent");

  if (!zoomModal || !zoomContent) return;

  const openZoom = (card) => {
    zoomContent.innerHTML = card.innerHTML; // só o conteúdo do card
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
});
