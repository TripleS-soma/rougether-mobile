#!/usr/bin/env python3
"""캐릭터 아트 일관성 감사 (2026-11-09) — docs/design/character-style-guide.md의 합격 기준을 잰다.

의존성: python3(표준 라이브러리만) + ffmpeg(webp/png 디코딩).
사용: python3 scripts/character-art-audit.py [이미지 폴더]   (기본 assets/images/characters)

이미지마다 캔버스 크기, 외곽선 색(불투명 픽셀 중 가장 어두운 4%의 평균), 선 굵기(가로 스캔의
어두운 픽셀 연속 길이 중앙값, px), 볼터치 색, 그림 바운딩 박스, 바닥선(가장 아래 불투명 행)을
출력하고, 세트 전체에서 기준을 벗어난 항목을 마지막에 모아 보여 준다.
**package.json 스크립트로 등록하지 말 것** — 스크립트 한 줄도 런타임 지문을 바꾼다(AGENTS.md).
"""
import os
import subprocess
import sys
import tempfile

# 스타일 가이드의 목표값 (332×285 캔버스 기준)
TARGET_CANVAS = (332, 285)
TARGET_STROKE_PX = 2
MAX_OUTLINE_SPREAD = 40  # 세트 안 외곽선 밝기 차이 허용치(0~255)
DARK_SHARE = 25  # 가장 어두운 1/25 = 4%


def decode(path, tmp):
    out = os.path.join(tmp, "frame.rgba")
    subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-y", "-i", path, "-f", "rawvideo", "-pix_fmt", "rgba", out],
        check=True,
    )
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
         "-of", "csv=p=0", path],
        check=True, capture_output=True, text=True,
    ).stdout.strip().split("\n")[0]
    w, h = (int(v) for v in probe.split(","))
    data = open(out, "rb").read()
    frame = w * h * 4  # 움직이는 webp는 첫 장면만 본다
    data = data[:frame]
    return w, h, [tuple(data[i:i + 4]) for i in range(0, len(data), 4)]


def lum(p):
    return 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]


def hexc(c):
    return "#%02x%02x%02x" % c if c else "-"


def analyze(path, tmp):
    w, h, px = decode(path, tmp)
    opaque = [p for p in px if p[3] > 200]
    dark = sorted(opaque, key=lum)[: max(1, len(opaque) // DARK_SHARE)]
    outline = tuple(sum(p[i] for p in dark) // len(dark) for i in range(3))
    thr = lum(outline) + 45
    runs = []
    for y in range(0, h, 3):
        run = 0
        for x in range(w):
            p = px[y * w + x]
            if p[3] > 200 and lum(p) < thr:
                run += 1
            else:
                if 1 <= run <= 12:
                    runs.append(run)
                run = 0
    runs.sort()
    stroke = runs[len(runs) // 2] if runs else 0
    pink = [p for p in opaque if p[0] > 220 and 140 < p[1] < 200 and 140 < p[2] < 200]
    blush = tuple(sum(p[i] for p in pink) // len(pink) for i in range(3)) if pink else None
    ys = [i // w for i, p in enumerate(px) if p[3] > 40]
    xs = [i % w for i, p in enumerate(px) if p[3] > 40]
    return {
        "canvas": (w, h),
        "outline": outline,
        "stroke": stroke,
        "blush": blush,
        "bbox": (max(xs) - min(xs) + 1, max(ys) - min(ys) + 1),
        "floor": h - 1 - max(ys),
    }


def main():
    folder = sys.argv[1] if len(sys.argv) > 1 else "assets/images/characters"
    files = sorted(f for f in os.listdir(folder) if f.lower().endswith((".webp", ".png")))
    results = {}
    with tempfile.TemporaryDirectory() as tmp:
        for f in files:
            results[f] = analyze(os.path.join(folder, f), tmp)

    print(f"{'file':<16}{'canvas':<11}{'outline':<10}{'stroke':<8}{'blush':<10}{'bbox':<11}floor")
    for f, r in results.items():
        print(f"{f:<16}{'%dx%d' % r['canvas']:<11}{hexc(r['outline']):<10}{r['stroke']:<8}"
              f"{hexc(r['blush']):<10}{'%dx%d' % r['bbox']:<11}{r['floor']}")

    issues = []
    for f, r in results.items():
        if r["canvas"] != TARGET_CANVAS:
            issues.append(f"{f}: 캔버스 {r['canvas'][0]}x{r['canvas'][1]} (목표 {TARGET_CANVAS[0]}x{TARGET_CANVAS[1]})")
        if r["stroke"] != TARGET_STROKE_PX:
            issues.append(f"{f}: 선 굵기 {r['stroke']}px (목표 {TARGET_STROKE_PX}px)")
    lums = [lum(r["outline"]) for r in results.values()]
    if lums and max(lums) - min(lums) > MAX_OUTLINE_SPREAD:
        issues.append(f"세트 외곽선 밝기 차이 {max(lums) - min(lums):.0f} (허용 {MAX_OUTLINE_SPREAD})")
    print()
    print("기준 이탈:" if issues else "기준 이탈 없음")
    for i in issues:
        print(" -", i)
    sys.exit(1 if issues else 0)


if __name__ == "__main__":
    main()
