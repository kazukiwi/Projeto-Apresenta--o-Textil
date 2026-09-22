import io
import json
import math
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, Depends
from PIL import Image, UnidentifiedImageError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.produtos import Produto

router = APIRouter(prefix="/api/visual-search", tags=["Busca visual"])

MAX_IMAGE_BYTES = 8 * 1024 * 1024
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
ALLOWED_CLOTHING_LABELS = {"jacket", "shirt", "pants", "shoes", "handbag", "backpack", "tie"}
CLOTHING_INFO = {
    "jacket": ("Jaqueta", "algodão, sarja, couro ou poliéster", "Peça de sobreposição usada para aquecer ou estruturar o look."),
    "shirt": ("Blusa ou camiseta", "algodão, linho, viscose ou malha", "Peça leve para a parte superior do corpo, com caimento e textura que variam conforme o tecido."),
    "pants": ("Calça", "denim, sarja, alfaiataria ou linho", "Peça para a parte inferior do corpo; o corte e a matéria-prima definem o movimento."),
    "shoes": ("Calçado", "couro, lona, borracha ou materiais sintéticos", "Elemento que combina proteção, conforto e acabamento na composição do look."),
    "handbag": ("Bolsa", "couro, lona, nylon ou materiais sintéticos", "Acessório funcional que acrescenta volume, textura e identidade ao visual."),
    "backpack": ("Mochila", "nylon, lona, couro ou poliéster", "Acessório estruturado para carregar objetos com conforto e praticidade."),
    "tie": ("Gravata", "seda, poliéster, lã ou algodão", "Acessório alongado usado para criar um ponto de acabamento na parte superior."),
}
STATIC_DIR = Path(__file__).resolve().parents[1] / "static"


async def _read_image(upload: UploadFile) -> tuple[bytes, Image.Image]:
    content_type = (upload.content_type or "").lower()
    if content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(415, "Envie uma imagem JPG, PNG ou WEBP.")
    data = await upload.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "A imagem deve ter no máximo 8 MB.")
    try:
        image = Image.open(io.BytesIO(data))
        image.verify()
        image = Image.open(io.BytesIO(data)).convert("RGB")
    except (UnidentifiedImageError, OSError):
        raise HTTPException(415, "O arquivo enviado não é uma imagem válida.")
    if image.width < 32 or image.height < 32:
        raise HTTPException(400, "A imagem deve ter pelo menos 32 por 32 pixels.")
    return data, image


def _feature_vector(image: Image.Image) -> list[float]:
    sample = image.resize((32, 32))
    pixels = list(sample.getdata())
    vector = []
    for channel in range(3):
        histogram = [0] * 16
        for pixel in pixels:
            histogram[pixel[channel] // 16] += 1
        total = len(pixels)
        vector.extend(value / total for value in histogram)
    return vector


def _similarity(left: list[float], right: list[float]) -> float:
    numerator = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if not left_norm or not right_norm:
        return 0.0
    return numerator / (left_norm * right_norm)


def _product_image(produto: Produto) -> Path | None:
    if not produto.imagem_path:
        return None
    relative = produto.imagem_path.strip().lstrip("/").replace("\\", "/")
    if relative.startswith("static/"):
        relative = relative[7:]
    path = (STATIC_DIR / relative).resolve()
    try:
        path.relative_to(STATIC_DIR.resolve())
    except ValueError:
        return None
    return path if path.is_file() else None


@router.post("/detect")
async def detect_visual_regions(
    image: UploadFile = File(...),
    detections_json: str = Form("[]"),
):
    """Valida a foto e as caixas produzidas pelo detector COCO-SSD no navegador."""
    _, source = await _read_image(image)
    try:
        detections = json.loads(detections_json)
    except json.JSONDecodeError:
        raise HTTPException(400, "Detecções inválidas.")
    if not isinstance(detections, list) or len(detections) > 20:
        raise HTTPException(400, "Lista de detecções inválida.")
    valid = []
    for detection in detections:
        if not isinstance(detection, dict):
            continue
        box = detection.get("bounding_box")
        label = str(detection.get("label", "")).strip()[:40]
        try:
            confidence = float(detection.get("confidence", 0))
        except (TypeError, ValueError):
            continue
        if label not in ALLOWED_CLOTHING_LABELS or not isinstance(box, dict) or not 0 <= confidence <= 1:
            continue
        try:
            x, y = float(box["x"]), float(box["y"])
            width, height = float(box["width"]), float(box["height"])
        except (KeyError, TypeError, ValueError):
            continue
        if width <= 0 or height <= 0 or x < 0 or y < 0 or x + width > source.width or y + height > source.height:
            continue
        name, materials, description = CLOTHING_INFO[label]
        valid.append({
            "label": label,
            "name": name,
            "materials": materials,
            "description": description,
            "confidence": round(confidence, 4),
            "source": detection.get("source", "detector"),
            "bounding_box": {"x": round(x), "y": round(y), "width": round(width), "height": round(height)},
        })
    return {
        "image": {"width": source.width, "height": source.height},
        "detections": valid,
        "analysis": {"model": "COCO-SSD", "scope": "clothing", "mode": "detecção direta e zonas corporais aproximadas"},
    }


@router.post("/search")
async def search_visual_products(
    image: UploadFile = File(...),
    label: str = Form("item"),
    db: Session = Depends(get_db),
):
    _, query_image = await _read_image(image)
    query_features = _feature_vector(query_image)
    results = []
    for produto in db.query(Produto).filter(Produto.ativo == True).order_by(Produto.nome).all():
        image_path = _product_image(produto)
        if image_path is None:
            continue
        try:
            with Image.open(image_path) as product_image:
                similarity = _similarity(query_features, _feature_vector(product_image.convert("RGB")))
        except (UnidentifiedImageError, OSError):
            continue
        results.append({
            "id": produto.id,
            "nome": produto.nome,
            "imagem": produto.imagem_url,
            "categoria": produto.categoria.nome if produto.categoria else "Moda",
            "preco": produto.preco_exibicao,
            "cor": produto.estoques_variacoes[0].cor if produto.estoques_variacoes else "Não informada",
            "marca": "Não informada",
            "similaridade": round(similarity, 4),
        })
    results.sort(key=lambda item: item["similaridade"], reverse=True)
    return {"label": label, "resultados": results[:12], "metodo": "histograma RGB normalizado"}