"""Audit actual Hangul outlines, not only cmap entries. Requires fonttools.

Run from the repository root:
    python3 scripts/audit-input-fonts.py > src/constants/input-font-coverage.json
The checked-in result is tied to asset SHA-256 hashes by a Jest regression test.
"""

import hashlib
import json
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.ttLib import TTFont


def audit(path):
    font = TTFont(path)
    cmap = font.getBestCmap()
    glyphs = font.getGlyphSet()
    drawn = set()
    mapped = 0
    for codepoint in range(0xAC00, 0xD7A4):
        glyph = cmap.get(codepoint)
        if glyph is None:
            continue
        mapped += 1
        pen = BoundsPen(glyphs)
        glyphs[glyph].draw(pen)
        if pen.bounds is not None:
            drawn.add(codepoint)
    probes = {}
    for char in "루게더겓겍":
        glyph = cmap.get(ord(char))
        probes[char] = {
            "mapped": glyph is not None,
            "hasOutline": ord(char) in drawn,
            "advance": font["hmtx"].metrics[glyph][0] if glyph else None,
        }
    return {
        "file": str(path),
        "family": font["name"].getDebugName(6),
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "hangulMapped": mapped,
        "hangulDrawn": len(drawn),
        "probes": probes,
    }


print(json.dumps([audit(p) for p in sorted(Path("assets/fonts").glob("*"))],
                 ensure_ascii=False, indent=2))
