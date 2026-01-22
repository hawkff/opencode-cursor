#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFont
import os

# ASCII art
ascii_art = """▄███████▄ ████████▄ █████████ ███▄    ██           ▄██████▄ ██     ██ ████████▄ ▄███████   ▄███████▄  ████████▄
██     ██ ██     ██ ██        ██▀██▄  ██          ██▀    ▀▀ ██     ██ ██     ██ ██         ██     ██  ██     ██
██     ██ ████████▀ ███████   ██  ██▄ ██ ████████ ██        ██     ██ ████████▀ ▀███████▄  ██     ██  ████████▀
██     ██ ██        ██        ██   ▀█▄██          ██▄    ▄▄ ██     ██ ██ ▀██▄          ██  ██     ██  ██ ▀██▄
▀███████▀ ██        █████████ ██    ▀███           ▀██████▀ ▀███████▀ ██   ▀███  ███████▀  ▀███████▀  ██   ▀███"""

# Use monospace font
try:
    # Try to use a common monospace font
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 16)
except:
    # Fallback to default font
    font = ImageFont.load_default()

# Calculate image size
lines = ascii_art.split('\n')
max_width = max(len(line) for line in lines)
char_width = 10  # approximate width per character
char_height = 20  # approximate height per line
padding = 40

width = max_width * char_width + padding * 2
height = len(lines) * char_height + padding * 2

# Create image with transparent background
img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Draw text in white
y_offset = padding
for line in lines:
    draw.text((padding, y_offset), line, fill=(255, 255, 255, 255), font=font)
    y_offset += char_height

# Save
output_path = os.path.join(os.path.dirname(__file__), 'docs', 'header.png')
os.makedirs(os.path.dirname(output_path), exist_ok=True)
img.save(output_path)
print(f"Header saved to {output_path}")
