(() => {
    "use strict";
    const categories = {
        "mens-shirts": ["roupas", "Camisas"],
        "womens-dresses": ["roupas", "Vestidos"],
        "mens-shoes": ["calcados", "Calçados masculinos"],
        "womens-shoes": ["calcados", "Calçados femininos"],
        "womens-bags": ["bolsas", "Bolsas"],
        "womens-jewellery": ["acessorios", "Acessórios"]
    };
    const grid = document.querySelector("#fashion-products");
    const status = document.querySelector("#products-status");
    const retry = document.querySelector("#products-retry");
    const more = document.querySelector("#products-more");
    const filters = document.querySelectorAll("[data-product-filter]");
    let products = [];
    let selected = "todos";
    let limit = 4;
    let loading = false;
    function node(tag, className, text) {
        const result = document.createElement(tag);
        result.className = className;
        if (text !== undefined) result.textContent = text;
        return result;
    }
    function imageUrl(value) {
        try {
            const url = new URL(value);
            return url.protocol === "https:" && url.hostname === "cdn.dummyjson.com" ? url.href : null;
        } catch { return null; }
    }
    function render() {
        const matches = products.filter(product => selected === "todos" || categories[product.category][0] === selected);
        const fragment = document.createDocumentFragment();
        matches.slice(0, limit).forEach(product => {
            const card = node("article", "concept-card product-card");
            const picture = node("div", "product-picture");
            const image = node("img", "");
            image.alt = product.title;
            image.loading = "lazy";
            image.decoding = "async";
            image.width = 360;
            image.height = 280;
            const unavailable = node("span", "product-image-unavailable", "Imagem indisponível");
            unavailable.hidden = true;
            image.addEventListener("error", () => { image.hidden = true; unavailable.hidden = false; });
            image.src = product.image;
            picture.append(image, unavailable);
            const body = node("div", "card-body");
            body.append(node("p", "card-category", categories[product.category][1]), node("h3", "", product.title));
            card.append(picture, body);
            fragment.append(card);
        });
        grid.replaceChildren(fragment);
        more.hidden = matches.length <= limit;
        status.textContent = matches.length ? Math.min(limit, matches.length) + " de " + matches.length + " produtos · Catálogo demonstrativo" : "Nenhum produto disponível nesta categoria.";
    }
    filters.forEach(button => button.addEventListener("click", () => {
        selected = button.dataset.productFilter;
        limit = 4;
        filters.forEach(item => item.setAttribute("aria-pressed", String(item === button)));
        if (!loading && products.length) render();
    }));
    more.addEventListener("click", () => {
        const previous = grid.children.length;
        limit += 4;
        render();
        const firstNew = grid.children[previous];
        if (firstNew) {
            firstNew.tabIndex = -1;
            firstNew.focus({preventScroll: true});
        }
    });
    async function loadProducts() {
        if (loading) return;
        loading = true;
        retry.hidden = true;
        status.textContent = "Carregando imagens de produtos…";
        grid.setAttribute("aria-busy", "true");
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 12000);
        try {
            const response = await fetch("https://dummyjson.com/products?limit=0&select=title,category,thumbnail", {
                signal: controller.signal, credentials: "omit"
            });
            if (!response.ok) throw new Error("HTTP " + response.status);
            const data = await response.json();
            if (!Array.isArray(data.products)) throw new Error("Invalid product response");
            const valid = data.products.filter(product => product && Object.hasOwn(categories, product.category) &&
                typeof product.title === "string" && product.title.trim() && imageUrl(product.thumbnail))
                .map(product => ({title: product.title, category: product.category, image: imageUrl(product.thumbnail)}));
            if (!valid.length) throw new Error("Empty fashion catalog");
            // Alternate categories so the first row includes different kinds of products.
            const groups = Object.keys(categories).map(category => valid.filter(product => product.category === category));
            products = [];
            for (let i = 0; i < Math.max(...groups.map(group => group.length)); i++) {
                groups.forEach(group => { if (group[i]) products.push(group[i]); });
            }
            render();
        } catch {
            status.textContent = "Não foi possível carregar as imagens agora. Tente novamente.";
            retry.hidden = false;
        } finally {
            clearTimeout(timer);
            loading = false;
            grid.setAttribute("aria-busy", "false");
        }
    }
    retry.addEventListener("click", loadProducts);
    loadProducts();
})();
