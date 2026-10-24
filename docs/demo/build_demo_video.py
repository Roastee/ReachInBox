"""Build the short, dependency-light ReachInbox visual walkthrough.

The generated MP4 and GIF use public, sanitized screenshots only.  Run from
the repository root with a Python environment that has Pillow and OpenCV:

    python docs/demo/build_demo_video.py
"""

from __future__ import annotations

import textwrap
from pathlib import Path

import cv2
from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[2]
SCREENSHOTS = ROOT / "docs" / "screenshots"
OUTPUT = ROOT / "docs" / "demo"
WIDTH, HEIGHT = 1280, 720
FPS = 12

BG = "#f3f9f5"
INK = "#1b2d26"
MUTED = "#6d7c74"
GREEN = "#18a968"
LIGHT_GREEN = "#d9f4e7"
WHITE = "#ffffff"


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        Path("C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


TITLE = load_font(54, bold=True)
SUBTITLE = load_font(26)
BODY = load_font(24)
SMALL = load_font(18)
LABEL = load_font(15, bold=True)


def new_canvas() -> Image.Image:
    return Image.new("RGB", (WIDTH, HEIGHT), BG)


def draw_wrapped(draw: ImageDraw.ImageDraw, text: str, xy: tuple[int, int], width: int, font, fill: str, spacing: int = 10) -> int:
    lines = []
    for paragraph in text.split("\n"):
        lines.extend(textwrap.wrap(paragraph, width=width) or [""])
    x, y = xy
    for line in lines:
        draw.text((x, y), line, font=font, fill=fill)
        y += font.size + spacing
    return y


def card(title: str, body: str, eyebrow: str, link: str | None = None) -> Image.Image:
    image = new_canvas()
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((70, 70, WIDTH - 70, HEIGHT - 70), radius=28, fill=WHITE, outline="#d8e6de", width=2)
    draw.rounded_rectangle((112, 112, 178, 178), radius=18, fill=LIGHT_GREEN)
    draw.rectangle((132, 132, 158, 158), outline=GREEN, width=4)
    draw.line((158, 145, 168, 145), fill=GREEN, width=4)
    draw.text((112, 218), eyebrow.upper(), font=LABEL, fill=GREEN)
    draw.text((112, 258), title, font=TITLE, fill=INK)
    draw_wrapped(draw, body, (112, 350), width=62, font=BODY, fill=MUTED, spacing=12)
    if link:
        draw.rounded_rectangle((112, 548, 890, 606), radius=16, fill=LIGHT_GREEN)
        draw.text((136, 564), link, font=SMALL, fill=INK)
    draw.text((112, HEIGHT - 58), "ReachInbox | calm, controlled email scheduling", font=SMALL, fill=MUTED)
    return image


def image_slide(path: Path, title: str, caption: str) -> Image.Image:
    image = new_canvas()
    draw = ImageDraw.Draw(image)
    draw.text((70, 42), title, font=load_font(34, bold=True), fill=INK)
    draw.text((70, 88), caption, font=SMALL, fill=MUTED)

    source = Image.open(path).convert("RGB")
    framed = ImageOps.contain(source, (1110, 570))
    frame_x = (WIDTH - framed.width) // 2
    frame_y = 132 + (570 - framed.height) // 2
    draw.rounded_rectangle(
        (frame_x - 12, frame_y - 12, frame_x + framed.width + 12, frame_y + framed.height + 12),
        radius=18,
        fill=WHITE,
        outline="#d8e6de",
        width=2,
    )
    image.paste(framed, (frame_x, frame_y))
    draw.text((70, HEIGHT - 42), "ReachInbox | production proof", font=SMALL, fill=MUTED)
    return image


def build() -> None:
    login = SCREENSHOTS / "reachinbox-login.png"
    deployment = SCREENSHOTS / "production-deployment.png"
    if not login.exists() or not deployment.exists():
        raise FileNotFoundError("Expected sanitized screenshots under docs/screenshots/")

    slides = [
        (card(
            "ReachInbox",
            "A focused workspace for planning outreach, pacing delivery, and inspecting every message before and after it is sent.",
            "Email, with intention",
            "Live demo: https://web-ashy-pi-63.vercel.app/login",
        ), 3.0),
        (image_slide(login, "1. Sign in", "Use Google OAuth or the email/password form to enter the workspace."), 3.0),
        (card(
            "Why this exists",
            "Teams often need more control than a one-click bulk sender provides. ReachInbox keeps recipients, pacing, attachments, delivery state, and previews in one place while preventing accidental duplicate queues.",
            "The assignment",
        ), 3.4),
        (image_slide(deployment, "2. Deployed and ready", "The Vercel production deployment is connected to the Railway API and the working stable alias."), 3.0),
        (card(
            "Try the live app",
            "Open the link, sign in, compose a message, add recipients or a CSV/TXT list, choose a delay, and review Scheduled or Sent. Demo delivery uses Ethereal preview links instead of contacting real recipients.",
            "Quick walkthrough",
            "https://web-ashy-pi-63.vercel.app/login",
        ), 3.2),
    ]

    mp4_path = OUTPUT / "reachinbox-walkthrough.mp4"
    gif_path = OUTPUT / "reachinbox-walkthrough.gif"
    writer = cv2.VideoWriter(
        str(mp4_path),
        cv2.VideoWriter_fourcc(*"mp4v"),  # type: ignore[attr-defined]
        FPS,
        (WIDTH, HEIGHT),
    )
    if not writer.isOpened():
        raise RuntimeError("OpenCV could not create the MP4 writer")

    gif_frames: list[Image.Image] = []
    gif_durations: list[int] = []
    for slide, seconds in slides:
        frame = slide.convert("RGB")
        bgr = cv2.cvtColor(__import__("numpy").array(frame), cv2.COLOR_RGB2BGR)
        for _ in range(round(seconds * FPS)):
            writer.write(bgr)
        gif_frames.append(frame)
        gif_durations.append(round(seconds * 1000))
    writer.release()

    gif_frames[0].save(
        gif_path,
        save_all=True,
        append_images=gif_frames[1:],
        duration=gif_durations,
        loop=0,
        optimize=True,
    )
    print(f"created {mp4_path}")
    print(f"created {gif_path}")


if __name__ == "__main__":
    build()
