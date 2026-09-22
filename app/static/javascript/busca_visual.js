(() => {
    "use strict";
    const input = document.querySelector("#visual-image-input");
    const dropzone = document.querySelector("#visual-dropzone");
    const workspace = document.querySelector("#visual-workspace");
    const preview = document.querySelector("#visual-preview-image");
    const layer = document.querySelector("#visual-hotspot-layer");
    const connections = document.querySelector("#visual-connections");
    const status = document.querySelector("#visual-status");
    const hint = document.querySelector("#visual-hint");
    const detectedList = document.querySelector("#visual-detected-list");
    const piecePanel = document.querySelector("#visual-piece-panel");
    const pieceName = document.querySelector("#visual-piece-name");
    const pieceType = document.querySelector("#visual-piece-type");
    const pieceMaterials = document.querySelector("#visual-piece-materials");
    const piecePrice = document.querySelector("#visual-piece-price");
    const pieceColor = document.querySelector("#visual-piece-color");
    const pieceBrand = document.querySelector("#visual-piece-brand");
    const results = document.querySelector("#visual-products");
    const clothing = {
        jacket: {name: "Jaqueta", materials: "algodão, sarja, couro ou poliéster", description: "Peça de sobreposição usada para aquecer ou estruturar o look."},
        shirt: {name: "Blusa ou camiseta", materials: "algodão, linho, viscose ou malha", description: "Peça leve para a parte superior do corpo, com caimento e textura que variam conforme o tecido."},
        pants: {name: "Calça", materials: "denim, sarja, alfaiataria ou linho", description: "Peça para a parte inferior do corpo; o corte e a matéria-prima definem o movimento."},
        shoes: {name: "Calçado", materials: "couro, lona, borracha ou materiais sintéticos", description: "Elemento que combina proteção, conforto e acabamento na composição do look."},
        handbag: {name: "Bolsa", materials: "couro, lona, nylon ou materiais sintéticos", description: "Acessório funcional que acrescenta volume, textura e identidade ao visual."},
        backpack: {name: "Mochila", materials: "nylon, lona, couro ou poliéster", description: "Acessório estruturado para carregar objetos com conforto e praticidade."},
        tie: {name: "Gravata", materials: "seda, poliéster, lã ou algodão", description: "Acessório alongado usado para criar um ponto de acabamento na parte superior."}
    };
    let file;
    let detections = [];

    function setStatus(message) { status.textContent = message; }
    function selectPiece(detection) {
        piecePanel.hidden = false;
        pieceName.textContent = detection.name;
        pieceType.textContent = detection.name;
        pieceMaterials.textContent = detection.materials;
        piecePrice.textContent = "Buscando no catálogo...";
        pieceColor.textContent = "Não identificada";
        pieceBrand.textContent = "Não informada";
        document.querySelectorAll(".visual-detected-item").forEach(item => item.classList.remove("is-selected"));
    }
    function productCard(product) {
        const article = document.createElement("article");
        article.className = "concept-card product-card";
        article.innerHTML = `<div class="product-picture"><img loading="lazy" src="${product.imagem}" alt=""></div><div class="card-body"><p class="card-category">${product.categoria}</p><h3></h3><p class="card-description">Comparação visual calculada pelo catálogo local.</p></div>`;
        article.querySelector("h3").textContent = product.nome;
        article.querySelector("img").alt = product.nome;
        return article;
    }
    function cropDetection(detection) {
        const box = detection.bounding_box;
        const scale = preview.naturalWidth / preview.clientWidth;
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(32, Math.round(box.width * scale));
        canvas.height = Math.max(32, Math.round(box.height * scale));
        canvas.getContext("2d").drawImage(preview, box.x * scale, box.y * scale, box.width * scale, box.height * scale, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/jpeg", 0.88);
    }
    function showDetections(data) {
        layer.replaceChildren();
        connections.replaceChildren();
        detections = data.detections;
        const scaleX = preview.clientWidth / data.image.width;
        const scaleY = preview.clientHeight / data.image.height;
        detectedList.replaceChildren();
        detections.forEach((detection, index) => {
            const box = detection.bounding_box;
            const hotspot = document.createElement("button");
            hotspot.type = "button";
            hotspot.className = "visual-hotspot";
            hotspot.style.left = `${(box.x + box.width / 2) * scaleX}px`;
            hotspot.style.top = `${(box.y + box.height / 2) * scaleY}px`;
            hotspot.setAttribute("aria-label", `Explorar ${detection.name}`);
            const card = document.createElement("button");
            card.type = "button";
            card.className = "visual-piece-card";
            card.innerHTML = `<img alt=""><span></span>`;
            card.querySelector("img").src = cropDetection(detection);
            card.querySelector("img").alt = detection.name;
            card.querySelector("span").textContent = detection.name;
            card.style.left = `${Math.min(78, Math.max(4, (box.x + box.width) * scaleX / preview.clientWidth * 100 + 3))}%`;
            card.style.top = `${Math.min(82, Math.max(4, (box.y + box.height / 2) * scaleY / preview.clientHeight * 100 - 9))}%`;
            const anchorX = (box.x + box.width / 2) * scaleX;
            const anchorY = (box.y + box.height / 2) * scaleY;
            const cardX = (parseFloat(card.style.left) / 100) * preview.clientWidth;
            const cardY = (parseFloat(card.style.top) / 100) * preview.clientHeight + 30;
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.classList.add("visual-connection");
            path.setAttribute("d", `M ${anchorX} ${anchorY} C ${(anchorX + cardX) / 2} ${anchorY}, ${(anchorX + cardX) / 2} ${cardY}, ${cardX} ${cardY}`);
            const activate = () => { selectPiece(detection); layer.querySelectorAll(".is-active").forEach(item => item.classList.remove("is-active")); connections.querySelectorAll(".is-active").forEach(item => item.classList.remove("is-active")); hotspot.classList.add("is-active"); card.classList.add("is-active"); path.classList.add("is-active"); searchDetection(index); };
            [hotspot, card].forEach(item => { item.addEventListener("mouseenter", () => { hotspot.classList.add("is-hovered"); card.classList.add("is-hovered"); path.classList.add("is-hovered"); }); item.addEventListener("mouseleave", () => { hotspot.classList.remove("is-hovered"); card.classList.remove("is-hovered"); path.classList.remove("is-hovered"); }); item.addEventListener("click", activate); });
            layer.append(hotspot, card);
            connections.append(path);
            const item = document.createElement("button");
            item.type = "button";
            item.className = "visual-detected-item";
            item.innerHTML = `<img alt=""><strong>${detection.name}</strong>`;
            item.querySelector("img").src = cropDetection(detection);
            item.querySelector("img").alt = detection.name;
            item.addEventListener("mouseenter", () => { hotspot.classList.add("is-hovered"); card.classList.add("is-hovered"); path.classList.add("is-hovered"); });
            item.addEventListener("mouseleave", () => { hotspot.classList.remove("is-hovered"); card.classList.remove("is-hovered"); path.classList.remove("is-hovered"); });
            item.addEventListener("click", () => { selectPiece(detection); item.classList.add("is-selected"); activate(); });
            detectedList.append(item);
        });
        if (!detections.length) {
            setStatus("Nenhuma área de moda foi detectada.");
            hint.textContent = "Tente uma foto com a peça inteira visível e boa iluminação.";
        } else {
            setStatus(`${detections.length} peça(s) de roupa detectada(s).`);
            hint.textContent = "Passe o mouse sobre os detalhes do look e clique em uma peça para explorar o catálogo.";
        }
    }
    async function detect() {
        workspace.hidden = false;
        dropzone.hidden = true;
        setStatus("Carregando detector e analisando imagem…");
        try {
            const model = await cocoSsd.load();
            const predictions = await model.detect(preview);
            const accepted = [];
            predictions.filter(item => item.score >= 0.45 && clothing[item.class] && item.class !== "person").forEach(item => accepted.push({
                label: item.class, confidence: item.score, source: "detector", bounding_box: {x: item.bbox[0], y: item.bbox[1], width: item.bbox[2], height: item.bbox[3]}
            }));
            const form = new FormData();
            form.append("image", file);
            form.append("detections_json", JSON.stringify(accepted));
            const response = await fetch("/api/visual-search/detect", {method: "POST", body: form});
            if (!response.ok) throw new Error("detect");
            showDetections(await response.json());
        } catch (error) {
            setStatus("Não foi possível analisar esta imagem.");
            hint.textContent = "Verifique a conexão para carregar o detector e tente novamente.";
        }
    }
    async function searchDetection(index) {
        const detection = detections[index];
        selectPiece(detection);
        const box = detection.bounding_box;
        const canvas = document.createElement("canvas");
        const scale = preview.naturalWidth / preview.clientWidth;
        canvas.width = Math.max(32, Math.round(box.width * scale));
        canvas.height = Math.max(32, Math.round(box.height * scale));
        canvas.getContext("2d").drawImage(preview, box.x * scale, box.y * scale, box.width * scale, box.height * scale, 0, 0, canvas.width, canvas.height);
        setStatus(`Buscando ${clothing[detection.label].name} no catálogo…`);
        results.replaceChildren();
        const cropped = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.9));
        const form = new FormData();
        form.append("image", cropped, "peca.jpg");
        form.append("label", clothing[detection.label].name);
        try {
            const response = await fetch("/api/visual-search/search", {method: "POST", body: form});
            if (!response.ok) throw new Error("search");
            const data = await response.json();
            setStatus(`${data.resultados.length} produto(s) encontrado(s) para ${data.label}.`);
            const first = data.resultados[0];
            if (first) {
                piecePrice.textContent = first.preco ? `R$ ${Number(first.preco).toFixed(2).replace(".", ",")}` : "Não informado";
                pieceColor.textContent = first.cor || "Não informada";
                pieceBrand.textContent = first.marca || "Não informada";
            }
            data.resultados.forEach(product => results.append(productCard(product)));
            hint.textContent = "Peças selecionadas para você explorar no catálogo.";
        } catch (error) {
            setStatus("Não foi possível buscar produtos agora.");
        }
    }
    function acceptImage(selected) {
        if (!selected || !/^image\/(jpeg|png|webp)$/.test(selected.type) || selected.size > 8 * 1024 * 1024) {
            setStatus("Escolha JPG, PNG ou WEBP com até 8 MB.");
            return;
        }
        file = selected;
        preview.src = URL.createObjectURL(file);
        preview.onload = detect;
    }
    input.addEventListener("change", () => acceptImage(input.files[0]));
    ["dragenter", "dragover"].forEach(event => dropzone.addEventListener(event, e => {e.preventDefault(); dropzone.classList.add("is-dragging");}));
    ["dragleave", "drop"].forEach(event => dropzone.addEventListener(event, e => {e.preventDefault(); dropzone.classList.remove("is-dragging");}));
    dropzone.addEventListener("drop", event => acceptImage(event.dataTransfer.files[0]));
})();