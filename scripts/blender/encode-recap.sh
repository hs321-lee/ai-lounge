#!/usr/bin/env bash
# recap-3d.py --mode anim 결과(2프레임 간격 투명 PNG)를 카드 바탕색 위에 얹어 슬라이드용 mp4로 묶습니다.
#   bash scripts/blender/encode-recap.sh <anim 폴더> [출력 폴더]
# 카드 바탕(#f3eadd, style.css .recap-visual)과 같은 색을 깔고 BT.709로 표시해 정지 그림과 색이 이어지게 합니다.
set -euo pipefail
anim=${1:?anim 폴더 필요}
out=${2:-assets/ai-specialist}
for scene in attention quantization rag; do
  ffmpeg -loglevel error -y \
    -f lavfi -i "color=c=0xf3eadd:s=800x600:r=15" \
    -framerate 15 -pattern_type glob -i "$anim/$scene/$scene-*.png" \
    -filter_complex "[0][1]overlay=format=auto:shortest=1,fps=30,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" \
    -c:v libx264 -preset slow -crf 21 -an \
    -colorspace bt709 -color_primaries bt709 -color_trc bt709 -movflags +faststart \
    "$out/recap-3d-$scene.mp4"
  echo "$out/recap-3d-$scene.mp4"
done
