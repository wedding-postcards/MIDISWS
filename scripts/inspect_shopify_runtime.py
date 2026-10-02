"""Print focused excerpts from the saved Shopify runtime for manual audit."""

from pathlib import Path


root = Path(__file__).resolve().parents[2] / "references" / "version-4" / "Ассеты_референса" / "Shopify_Hero"
for filename, tokens in {
    "Background-CGKUhMwd.js": ["function lI", "function cI", "const cp", 'new fl("Overlay"', "function oI", "const Tr", "Tr=", "ap=", "function sI"],
    "Effects-WhEp4HUr.js": ["function hg"],
}.items():
    source = (root / filename).read_text(encoding="utf-8")
    for token in tokens:
        index = source.find(token)
        print(f"\n=== {filename}: {token} @ {index} ===")
        print(source[index:index + 2600] if index >= 0 else "missing")

desktop = Path.home() / "Desktop" / "МИДИС — сайт" / "Папка refernc Shopi"
for html in desktop.glob("*.html"):
    source = html.read_text(encoding="utf-8", errors="ignore")
    for token in ["EW26_Sidekick", "Sidekick_bg", "Sidekick_fg"]:
        index = source.find(token)
        if index >= 0:
            print(f"\n=== {html.name}: {token} @ {index} ===")
            print(source[index - 1000:index + 2400])
