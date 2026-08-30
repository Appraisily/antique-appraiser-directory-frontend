#!/usr/bin/env python3
"""Generate branded 1200x630 city share cards for directory location pages.

These are share/preview images, not appraiser portraits. Do not use listing
photos or generated profile artwork as the city og:image.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

WIDTH = 1200
HEIGHT = 630
BACKGROUND = (250, 248, 243)
NAVY = (28, 25, 23)
BRASS = (154, 107, 31)
FOREST = (29, 74, 56)
MUTED = (106, 98, 82)

CITY_NAME_OVERRIDES = {
    "st-john-s": "St. John's",
    "st-louis": "St. Louis",
    "st-paul": "St. Paul",
    "washington-dc": "Washington, DC",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--public-dir", default="public_site")
    parser.add_argument("--cities-file", default="src/data/cities.json")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    if args.write == args.check:
        parser.error("Choose exactly one of --write or --check")
    return args


def load_font(paths: list[str], size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in paths:
        candidate = Path(path)
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


def title_case_slug(slug: str) -> str:
    if slug in CITY_NAME_OVERRIDES:
        return CITY_NAME_OVERRIDES[slug]
    return " ".join(part.capitalize() for part in slug.split("-"))


def wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int) -> list[str]:
    words = text.split()
    if not words:
        return [text]
    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        candidate = f"{current} {word}"
        if draw.textlength(candidate, font=font) <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def render_card(city_name: str, state_name: str | None) -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT), BACKGROUND)
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, 28, HEIGHT), fill=BRASS)
    draw.rectangle((28, 0, WIDTH, 18), fill=FOREST)

    kicker_font = load_font(
        ["/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"],
        28,
    )
    title_font = load_font(
        [
            "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
        ],
        84,
    )
    body_font = load_font(
        ["/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"],
        32,
    )

    left = 88
    draw.text((left, 92), "ANTIQUE APPRAISER DIRECTORY", fill=BRASS, font=kicker_font)

    max_title_width = WIDTH - left - 80
    title_lines = wrap_text(draw, city_name, title_font, max_title_width)
    y = 160
    for line in title_lines[:3]:
        draw.text((left, y), line, fill=NAVY, font=title_font)
        y += 94

    subtitle = "Compare local specialists or start a signed online report."
    if state_name:
        subtitle = f"{state_name}. Compare local specialists or start a signed online report."
    draw.rectangle((left, y + 8, left + 92, y + 14), fill=FOREST)
    draw.text((left, y + 36), subtitle, fill=MUTED, font=body_font)
    return image


def city_pages(public_dir: Path) -> list[Path]:
    location_root = public_dir / "location"
    pages = []
    for entry in sorted(location_root.iterdir()):
        if not entry.is_dir():
            continue
        page = entry / "index.html"
        if page.exists():
            pages.append(page)
    return pages


def main() -> int:
    args = parse_args()
    repo_root = Path(__file__).resolve().parents[1]
    public_dir = Path(args.public_dir)
    if not public_dir.is_absolute():
        public_dir = (Path.cwd() / public_dir).resolve()
    cities_file = Path(args.cities_file)
    if not cities_file.is_absolute():
        cities_file = (repo_root / cities_file).resolve()

    cities_by_slug = {
        city["slug"]: city
        for city in json.loads(cities_file.read_text(encoding="utf-8"))["cities"]
    }
    output_dir = public_dir / "assets" / "og"
    pages = city_pages(public_dir)
    if not pages:
        print("No location pages found", file=sys.stderr)
        return 1

    missing = []
    stale = []
    written = 0
    for page in pages:
        slug = page.parent.name
        city = cities_by_slug.get(slug, {})
        city_name = city.get("name") or title_case_slug(slug)
        state_name = city.get("state")
        target = output_dir / f"location-{slug}.jpg"
        card = render_card(city_name, state_name)
        if args.check:
            if not target.exists():
                missing.append(str(target.relative_to(public_dir)))
                continue
            current = Image.open(target)
            if current.size != (WIDTH, HEIGHT):
                stale.append(str(target.relative_to(public_dir)))
            continue
        output_dir.mkdir(parents=True, exist_ok=True)
        card.save(target, format="JPEG", quality=84, optimize=True, progressive=True)
        written += 1

    result = {
        "action": "checked-location-og-images" if args.check else "generated-location-og-images",
        "publicDir": str(public_dir),
        "pages": len(pages),
        "written": written,
        "missing": missing,
        "stale": stale,
    }
    print(json.dumps(result, indent=2))
    if args.check and (missing or stale):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
