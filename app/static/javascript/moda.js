(() => {
    "use strict";
    // Editorial selection: the API enriches these topics; this is not an exhaustive catalog.
    const topics = [
        ["Vintage", "Vintage", "estilos", "Referências de outras épocas para explorar a relação entre moda, memória e identidade."],
        ["Lilás", "Lilás", "cores", "Um ponto de partida suave para composições com tons próximos ou contrastes profundos."],
        ["Linho", "Linho", "tecidos", "Conheça a fibra e sua relação com a produção de tecidos e peças de vestuário."],
        ["Chanel", "Chanel", "marcas", "Explore a história e as referências de uma das marcas presentes no universo da moda."],
        ["Inditex", "Inditex", "empresas", "Conheça um dos grupos empresariais que fazem parte da indústria do vestuário."],
        ["Alta-costura", "Alta-costura", "estilos", "Um encontro entre criação, técnicas de confecção e atenção aos detalhes."],
        ["Índigo", "Índigo", "cores", "Explore a história desse tom e suas conexões com os pigmentos e a moda."],
        ["Algodão", "Algodão", "tecidos", "Uma fibra para conhecer de perto e compreender melhor o universo têxtil."],
        ["Gucci", "Gucci", "marcas", "Descubra a trajetória e o repertório de uma marca italiana de moda."],
        ["LVMH", "LVMH", "empresas", "Explore a relação entre marcas, criação e os grupos do setor de luxo."],
        ["Prêt-à-porter", "Prêt-à-porter", "estilos", "Conheça o conceito de pronto para vestir e seu lugar na produção de moda."],
        ["Violeta", "Violeta (cor)", "cores", "Uma referência cromática para experimentar novas combinações e contrastes."],
        ["Seda", "Seda", "tecidos", "Uma introdução à fibra, à sua origem e às possibilidades de uso nos tecidos."],
        ["Prada", "Prada", "marcas", "Conheça a história de uma marca italiana e amplie suas referências."],
        ["Kering", "Kering", "empresas", "Conheça outro grupo que reúne marcas no universo da moda e do luxo."]
    ].map(([name, title, category, fallback], index) => ({name, title, category, fallback, index}));
    const labels = {estilos: "Estilos", cores: "Cores", tecidos: "Tecidos", marcas: "Marcas", empresas: "Empresas"};
    const icons = {estilos: "fa-shirt", cores: "fa-palette", tecidos: "fa-scissors", marcas: "fa-tag", empresas: "fa-building"};
    const grid = document.querySelector("#concept-grid");
    const search = document.querySelector("#fashion-search");
    const count = document.querySelector("#result-count");
    const status = document.querySelector("#api-status");
    const more = document.querySelector("#show-more");
    const retry = document.querySelector("#retry");
    const summaries = new Map();
    let category = "todos";
    let limit = 6;
    let loading = false;
    const normalize = value => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const sourceUrl = title => "https://pt.wikipedia.org/wiki/" + encodeURIComponent(title.replaceAll(" ", "_"));

    function element(tag, className, text) {
        const node = document.createElement(tag);
        node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function render() {
        const query = normalize(search.value.trim());
        const selected = topics.filter(topic => (category === "todos" || category === topic.category) &&
            normalize(topic.name + " " + labels[topic.category] + " " + topic.fallback).includes(query));
        const fragment = document.createDocumentFragment();
        selected.slice(0, limit).forEach((topic, index) => {
            const article = element("article", "concept-card");
            article.style.animationDelay = Math.min(index * 40, 200) + "ms";
            const art = element("div", "card-art art-" + topic.category);
            art.setAttribute("aria-hidden", "true");
            art.append(element("i", "fa-solid " + icons[topic.category]));
            const body = element("div", "card-body");
            const meta = element("div", "card-category");
            meta.append(element("span", "", labels[topic.category]), element("span", "", String(topic.index + 1).padStart(2, "0")));
            const description = summaries.get(topic.title);
            const paragraph = element("p", "card-description", description || topic.fallback);
            const link = element("a", "card-link", description ? "Ler na Wikipédia" : "Explorar na Wikipédia");
            link.href = sourceUrl(topic.title);
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.setAttribute("aria-label", "Conhecer " + topic.name + " na Wikipédia (nova aba)");
            const arrow = element("i", "fa-solid fa-arrow-right");
            arrow.setAttribute("aria-hidden", "true");
            link.append(arrow);
            body.append(meta, element("h3", "", topic.name), paragraph, link);
            article.append(art, body);
            fragment.append(article);
        });
        grid.replaceChildren(fragment);
        count.textContent = Math.min(limit, selected.length) + " de " + selected.length + " referências";
        more.hidden = selected.length <= limit;
        document.querySelector("#empty-state").hidden = selected.length !== 0;
    }

    document.querySelectorAll("[data-filter]").forEach(button => button.addEventListener("click", () => {
        category = button.dataset.filter;
        limit = 6;
        document.querySelectorAll("[data-filter]").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
        render();
    }));
    search.addEventListener("input", () => { limit = 6; render(); });
    more.addEventListener("click", () => {
        const previousCount = grid.children.length;
        limit += 6;
        render();
        grid.children[previousCount]?.querySelector("a").focus({preventScroll: true});
    });
    document.querySelectorAll("[data-color]").forEach(button => button.addEventListener("click", () => {
        document.querySelector("#selected-color").textContent = button.dataset.color;
        document.querySelectorAll("[data-color]").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
    }));
    const heroImage = document.querySelector(".editorial-photo img");
    heroImage.addEventListener("error", () => { heroImage.hidden = true; });
    if (heroImage.complete && !heroImage.naturalWidth) heroImage.hidden = true;

    async function loadReferences() {
        if (loading) return;
        loading = true;
        retry.hidden = true;
        status.textContent = "Consultando referências na Wikipédia…";
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        try {
            const params = new URLSearchParams({
                action: "query", format: "json", formatversion: "2", origin: "*",
                prop: "extracts", exintro: "1", explaintext: "1", exchars: "420",
                exlimit: "20", redirects: "1", titles: topics.map(topic => topic.title).join("|")
            });
            const response = await fetch("https://pt.wikipedia.org/w/api.php?" + params, {
                signal: controller.signal, credentials: "omit"
            });
            if (!response.ok) throw new Error("HTTP " + response.status);
            const data = await response.json();
            if (data.error || !Array.isArray(data.query?.pages)) throw new Error("Invalid API response");
            const aliases = new Map([...(data.query.normalized || []), ...(data.query.redirects || [])].map(item => [item.from, item.to]));
            topics.forEach(topic => {
                let title = topic.title;
                const visited = new Set();
                while (aliases.has(title) && !visited.has(title)) {
                    visited.add(title);
                    title = aliases.get(title);
                }
                const page = data.query.pages.find(item => item.title === title && !item.missing);
                if (typeof page?.extract === "string" && page.extract.trim()) summaries.set(topic.title, page.extract.trim());
            });
            if (!summaries.size) throw new Error("No summaries");
            status.textContent = summaries.size === topics.length ? "Referências carregadas · Wikipédia" : "Wikipédia + seleção de apoio";
            retry.hidden = summaries.size === topics.length;
            render();
        } catch {
            status.textContent = "Consulta indisponível · exibindo seleção de apoio";
            retry.hidden = false;
        } finally {
            clearTimeout(timeout);
            loading = false;
        }
    }
    retry.addEventListener("click", loadReferences);
    render();
    loadReferences();
})();
