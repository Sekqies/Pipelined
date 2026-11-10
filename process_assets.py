#!/usr/bin/env python3
import subprocess
import os
from collections import deque

def crop_image(src, bbox, dest):
    x, y, w, h = bbox
    cmd = ['magick', src, '-crop', f'{w}x{h}+{x}+{y}', '+repage', dest]
    subprocess.run(cmd, check=True)
    print(f'Cropped {dest} ({w}x{h})')

def process_mascot():
    src = 'base-assets/WhatsApp Image 2026-11-09 at 02.06.11.jpeg'
    p = subprocess.Popen(['magick', src, 'rgb:-'], stdout=subprocess.PIPE)
    raw = p.stdout.read()
    w, h = 988, 1010

    def is_bg(r, g, b):
        if max(r, g, b) - min(r, g, b) > 22:
            return False
        return min(r, g, b) >= 190

    visited = bytearray(w * h)
    bg_mask = bytearray(w * h)
    queue = deque()

    # Outer edges
    for x in range(w):
        for y in [0, h-1]:
            idx = (y*w + x)*3
            if is_bg(raw[idx], raw[idx+1], raw[idx+2]) and not visited[y*w + x]:
                visited[y*w + x] = 1
                queue.append((x, y))
    for y in range(h):
        for x in [0, w-1]:
            idx = (y*w + x)*3
            if is_bg(raw[idx], raw[idx+1], raw[idx+2]) and not visited[y*w + x]:
                visited[y*w + x] = 1
                queue.append((x, y))

    # Inner holes seeds
    inner_seeds = [
        (200, 150), (210, 150), (180, 110),
        (330, 250), (430, 240), (745, 245), (835, 230),
        (460, 630), (460, 830), (460, 800), (470, 750),
        (340, 560), (560, 630), (390, 780), (510, 780)
    ]
    for (sx, sy) in inner_seeds:
        if 0 <= sx < w and 0 <= sy < h:
            idx = (sy*w + sx)*3
            if is_bg(raw[idx], raw[idx+1], raw[idx+2]) and not visited[sy*w + sx]:
                visited[sy*w + sx] = 1
                queue.append((sx, sy))

    while queue:
        x, y = queue.popleft()
        bg_mask[y*w + x] = 1
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h:
                nidx = ny * w + nx
                if not visited[nidx]:
                    visited[nidx] = 1
                    n_raw_idx = nidx * 3
                    if is_bg(raw[n_raw_idx], raw[n_raw_idx+1], raw[n_raw_idx+2]):
                        queue.append((nx, ny))

    # Also clean isolated noise in background (pixels surrounded by bg)
    rgba = bytearray(w * h * 4)
    min_x, max_x = w, 0
    min_y, max_y = h, 0

    for y in range(h):
        for x in range(w):
            i = y * w + x
            r, g, b = raw[i*3], raw[i*3+1], raw[i*3+2]
            if bg_mask[i] == 1:
                rgba[i*4 : i*4+4] = b'\x00\x00\x00\x00'
            else:
                rgba[i*4 : i*4+4] = bytes([r, g, b, 255])
                if x < min_x: min_x = x
                if x > max_x: max_x = x
                if y < min_y: min_y = y
                if y > max_y: max_y = y

    full_tmp = 'assets/processed/mascot_full_raw.png'
    proc = subprocess.Popen(['magick', '-size', f'{w}x{h}', '-depth', '8', 'rgba:-', full_tmp], stdin=subprocess.PIPE)
    proc.communicate(input=rgba)

    # Trim excess transparent border
    subprocess.run(['magick', full_tmp, '-trim', '+repage', 'assets/mascot-full.png'], check=True)
    print('Generated assets/mascot-full.png')

    # Crop logo: text '> Pipelined'
    # In original: y is from 70 to 330, x is from 40 to 880
    subprocess.run(['magick', 'assets/mascot-full.png', '-crop', '830x270+0+0', '+repage', '-trim', '+repage', 'assets/logo.png'], check=True)
    print('Generated assets/logo.png')

    # Crop mascot character without logo:
    subprocess.run(['magick', full_tmp, '-crop', '600x670+240+320', '+repage', '-trim', '+repage', 'assets/mascot.png'], check=True)
    print('Generated assets/mascot.png')

    # Crop mascot head / avatar:
    subprocess.run(['magick', full_tmp, '-crop', '380x260+310+320', '+repage', '-trim', '+repage', 'assets/mascot-head.png'], check=True)
    print('Generated assets/mascot-head.png')

    # Generate favicon
    subprocess.run(['magick', 'assets/mascot-head.png', '-resize', '64x64', 'favicon.png'], check=True)
    subprocess.run(['magick', 'favicon.png', '-resize', '32x32', 'favicon.ico'], check=True)
    print('Generated favicons')

def process_card_backs():
    src = 'base-assets/WhatsApp Image 2026-11-09 at 22.39.56.jpeg'
    # Left card: Green
    crop_image(src, (7, 9, 562, 773), 'assets/card-back-pipeline.png')
    # Right card: Red
    crop_image(src, (592, 10, 561, 771), 'assets/card-back-hazard.png')

def process_board():
    src = 'base-assets/WhatsApp Image 2026-11-10 at 04.51.30.jpeg'
    subprocess.run(['magick', src, 'assets/board.png'], check=True)
    print('Generated assets/board.png')

def find_card_bbox(sheet_path, col, row, total_cols=4, total_rows=4):
    p = subprocess.Popen(['magick', sheet_path, 'rgb:-'], stdout=subprocess.PIPE)
    raw = p.stdout.read()
    info = subprocess.run(['magick', sheet_path, '-format', '%w %h', 'info:'], capture_output=True, text=True).stdout.strip().split()
    w, h = int(info[0]), int(info[1])

    cw = w // total_cols
    ch = h // total_rows

    center_x = col * cw + cw // 2
    center_y = row * ch + ch // 2

    # Search outward to find borders of the card (where color switches from card border to white background)
    # Background is white > 240, card border is dark/colored < 180
    min_x, max_x = center_x, center_x
    min_y, max_y = center_y, center_y

    # horizontal scan around center_y
    for x in range(col * cw, (col + 1) * cw):
        idx = (center_y * w + x) * 3
        r, g, b = raw[idx], raw[idx+1], raw[idx+2]
        if not (r > 240 and g > 240 and b > 240):
            if x < min_x: min_x = x
            if x > max_x: max_x = x

    # vertical scan around center_x
    for y in range(row * ch, (row + 1) * ch):
        idx = (y * w + center_x) * 3
        r, g, b = raw[idx], raw[idx+1], raw[idx+2]
        if not (r > 240 and g > 240 and b > 240):
            if y < min_y: min_y = y
            if y > max_y: max_y = y

    # Expand box slightly to ensure clean border:
    pad = 0
    return (max(0, min_x - pad), max(0, min_y - pad), min(w, max_x - min_x + 1 + 2*pad), min(h, max_y - min_y + 1 + 2*pad))

def process_individual_cards():
    # Sheet 1: 04.57.26 (UC + ADDI)
    s1 = 'base-assets/WhatsApp Image 2026-11-10 at 04.57.26.jpeg'
    crop_image(s1, (8, 10, 433, 596), 'assets/cards/card-uc-memread.png')
    crop_image(s1, (1369, 10, 433, 596), 'assets/cards/card-uc-regwrite.png')
    crop_image(s1, (8, 610, 433, 596), 'assets/cards/card-uc-jmp.png')
    crop_image(s1, (461, 1210, 433, 596), 'assets/cards/card-uc-restore.png')
    crop_image(s1, (8, 1811, 433, 596), 'assets/cards/card-addi.png')

    # Sheet 3: 05.34.30 (SUB, BGT, ADD)
    s3 = 'base-assets/WhatsApp Image 2026-11-10 at 05.34.30.jpeg'
    crop_image(s3, (8, 10, 433, 596), 'assets/cards/card-sub.png')
    crop_image(s3, (8, 1210, 433, 596), 'assets/cards/card-bgt.png')
    crop_image(s3, (8, 1811, 433, 597), 'assets/cards/card-add.png')

    # Sheet 4: 06.38.34 (BNE, BLT, J, LW)
    s4 = 'base-assets/WhatsApp Image 2026-11-10 at 06.38.34.jpeg'
    crop_image(s4, (915, 10, 433, 596), 'assets/cards/card-bne.png')
    crop_image(s4, (8, 610, 433, 596), 'assets/cards/card-blt.png')
    crop_image(s4, (915, 1210, 433, 596), 'assets/cards/card-jump.png')
    crop_image(s4, (8, 1811, 433, 596), 'assets/cards/card-lw.png')

    # Sheet 5: 07.00.19 (SW)
    s5 = 'base-assets/WhatsApp Image 2026-11-10 at 07.00.19.jpeg'
    crop_image(s5, (447, 1207, 434, 596), 'assets/cards/card-sw.png')

    # Tokens sheet: 05.43.42
    s_tok = 'base-assets/WhatsApp Image 2026-11-10 at 05.43.42.jpeg'
    subprocess.run(['magick', s_tok, '-trim', '+repage', 'assets/cards/tokens-numbers.png'], check=True)
    print('Generated tokens-numbers.png')

if __name__ == '__main__':
    os.makedirs('assets/cards', exist_ok=True)
    os.makedirs('assets/processed', exist_ok=True)
    print('Processing Mascot...')
    process_mascot()
    print('Processing Card Backs...')
    process_card_backs()
    print('Processing Board...')
    process_board()
    print('Processing Individual Cards...')
    process_individual_cards()
    print('All assets processed successfully!')
