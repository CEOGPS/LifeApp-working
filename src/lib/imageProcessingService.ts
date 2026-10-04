/**
 * Image Processing Service
 * Canvas-based image manipulation for editing and generation
 */

export type ImageMimeType = "image/png" | "image/jpeg" | "image/webp";
export type GenerationMode =
  | "realism"
  | "cartoon"
  | "watercolor"
  | "abstract"
  | "3d";

export class ImageProcessor {
  private originalCanvas: HTMLCanvasElement | null = null;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private imageData: ImageData | null = null;
  private history: string[] = [];
  private historyStep = -1;

  constructor(_imageSrc?: string) {
    void _imageSrc;
    this.canvas = document.createElement("canvas");
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    this.ctx = ctx;
  }

  async loadImage(imageSrc: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        this.canvas.width = img.width;
        this.canvas.height = img.height;
        this.ctx.drawImage(img, 0, 0);

        const clone = document.createElement("canvas");
        clone.width = img.width;
        clone.height = img.height;
        const cloneCtx = clone.getContext("2d");
        if (!cloneCtx) return reject(new Error("2D canvas context unavailable"));
        cloneCtx.drawImage(img, 0, 0);
        this.originalCanvas = clone;

        this.saveState();
        resolve();
      };
      img.onerror = () => reject(new Error(`Failed to load image: ${imageSrc}`));
      img.src = imageSrc;
    });
  }

  saveState(): void {
    this.historyStep++;
    this.history = this.history.slice(0, this.historyStep);
    this.history.push(this.canvas.toDataURL());
  }

  undo(): void {
    if (this.historyStep > 0) {
      this.historyStep--;
      this.loadHistoryState(this.history[this.historyStep]);
    }
  }

  redo(): void {
    if (this.historyStep < this.history.length - 1) {
      this.historyStep++;
      this.loadHistoryState(this.history[this.historyStep]);
    }
  }

  loadHistoryState(dataUrl: string): void {
    const img = new Image();
    img.onload = () => {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(img, 0, 0);
    };
    img.src = dataUrl;
  }

  // ── Filters ──────────────────────────────────────────────────────────
  applyBrightness(value: number): void {
    // -100 to 100
    const img = new Image();
    img.onload = () => {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(img, 0, 0);
      this.ctx.fillStyle = `rgba(0, 0, 0, ${-value / 200})`;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.saveState();
    };
    img.src = this.canvas.toDataURL();
  }

  applyContrast(value: number): void {
    // -100 to 100
    const imageData = this.ctx.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height,
    );
    const data = imageData.data;
    const factor = (259 * (value + 255)) / (255 * (259 - value));

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128));
      data[i + 1] = Math.min(
        255,
        Math.max(0, factor * (data[i + 1] - 128) + 128),
      );
      data[i + 2] = Math.min(
        255,
        Math.max(0, factor * (data[i + 2] - 128) + 128),
      );
    }

    this.ctx.putImageData(imageData, 0, 0);
    this.saveState();
  }

  applySaturation(value: number): void {
    // -100 to 100
    const imageData = this.ctx.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height,
    );
    const data = imageData.data;
    const factor = (value + 100) / 100;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;

      data[i] = Math.min(255, Math.max(0, gray + (r - gray) * factor));
      data[i + 1] = Math.min(255, Math.max(0, gray + (g - gray) * factor));
      data[i + 2] = Math.min(255, Math.max(0, gray + (b - gray) * factor));
    }

    this.ctx.putImageData(imageData, 0, 0);
    this.saveState();
  }

  applyBlur(radius: number): void {
    const offscreenCanvas = document.createElement("canvas");
    offscreenCanvas.width = this.canvas.width;
    offscreenCanvas.height = this.canvas.height;
    const offscreenCtx = offscreenCanvas.getContext("2d");
    if (!offscreenCtx) return;

    offscreenCtx.filter = `blur(${radius}px)`;
    offscreenCtx.drawImage(this.canvas, 0, 0);

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(offscreenCanvas, 0, 0);
    this.saveState();
  }

  applyGrayscale(): void {
    const imageData = this.ctx.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height,
    );
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      data[i] = data[i + 1] = data[i + 2] = gray;
    }

    this.ctx.putImageData(imageData, 0, 0);
    this.saveState();
  }

  applySepia(): void {
    const imageData = this.ctx.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height,
    );
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      data[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
      data[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
      data[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
    }

    this.ctx.putImageData(imageData, 0, 0);
    this.saveState();
  }

  applyInvert(): void {
    const imageData = this.ctx.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height,
    );
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i];
      data[i + 1] = 255 - data[i + 1];
      data[i + 2] = 255 - data[i + 2];
    }

    this.ctx.putImageData(imageData, 0, 0);
    this.saveState();
  }

  // ── Transformations ──────────────────────────────────────────────────
  crop(x: number, y: number, width: number, height: number): void {
    const imgData = this.ctx.getImageData(x, y, width, height);
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx.putImageData(imgData, 0, 0);
    this.saveState();
  }

  resize(width: number, height: number): void {
    const offscreenCanvas = document.createElement("canvas");
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    const offscreenCtx = offscreenCanvas.getContext("2d");
    if (!offscreenCtx) return;
    offscreenCtx.drawImage(this.canvas, 0, 0, width, height);

    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx.drawImage(offscreenCanvas, 0, 0);
    this.saveState();
  }

  rotate(degrees: number): void {
    const rad = (degrees * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const newWidth =
      Math.abs(this.canvas.width * cos) + Math.abs(this.canvas.height * sin);
    const newHeight =
      Math.abs(this.canvas.width * sin) + Math.abs(this.canvas.height * cos);

    const offscreenCanvas = document.createElement("canvas");
    offscreenCanvas.width = newWidth;
    offscreenCanvas.height = newHeight;
    const offscreenCtx = offscreenCanvas.getContext("2d");
    if (!offscreenCtx) return;

    offscreenCtx.translate(newWidth / 2, newHeight / 2);
    offscreenCtx.rotate(rad);
    offscreenCtx.drawImage(
      this.canvas,
      -this.canvas.width / 2,
      -this.canvas.height / 2,
    );

    this.canvas.width = newWidth;
    this.canvas.height = newHeight;
    this.ctx.drawImage(offscreenCanvas, 0, 0);
    this.saveState();
  }

  flipH(): void {
    const offscreenCanvas = document.createElement("canvas");
    offscreenCanvas.width = this.canvas.width;
    offscreenCanvas.height = this.canvas.height;
    const offscreenCtx = offscreenCanvas.getContext("2d");
    if (!offscreenCtx) return;

    offscreenCtx.scale(-1, 1);
    offscreenCtx.drawImage(this.canvas, -this.canvas.width, 0);

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(offscreenCanvas, 0, 0);
    this.saveState();
  }

  // ── Drawing ──────────────────────────────────────────────────────────
  drawText(
    text: string,
    x: number,
    y: number,
    fontSize: number,
    color: string,
    fontFamily = "Arial",
  ): void {
    this.ctx.fillStyle = color;
    this.ctx.font = `${fontSize}px ${fontFamily}`;
    this.ctx.textAlign = "center";
    this.ctx.fillText(text, x, y);
    this.saveState();
  }

  // ── Export ───────────────────────────────────────────────────────────
  getBlob(type: ImageMimeType = "image/png"): Promise<Blob | null> {
    return new Promise<Blob | null>((resolve) => {
      this.canvas.toBlob((blob) => resolve(blob), type);
    });
  }

  getDataURL(type: ImageMimeType = "image/png"): string {
    return this.canvas.toDataURL(type);
  }
}

// ── Image Generation ─────────────────────────────────────────────────
export function generateImage(
  width: number,
  height: number,
  mode: GenerationMode,
  prompt = "",
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");

  switch (mode) {
    case "realism":
      generateRealistic(ctx, width, height, prompt);
      break;
    case "cartoon":
      generateCartoon(ctx, width, height, prompt);
      break;
    case "watercolor":
      generateWatercolor(ctx, width, height, prompt);
      break;
    case "abstract":
      generateAbstract(ctx, width, height, prompt);
      break;
    case "3d":
      generate3D(ctx, width, height, prompt);
      break;
  }

  return canvas;
}

function generateRealistic(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  prompt: string,
): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, "#87CEEB");
  gradient.addColorStop(1, "#90EE90");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "#FFD700";
  ctx.beginPath();
  ctx.arc(w * 0.8, h * 0.2, 50, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#8B7355";
  ctx.beginPath();
  ctx.moveTo(0, h * 0.6);
  ctx.lineTo(w * 0.3, h * 0.2);
  ctx.lineTo(w * 0.7, h * 0.4);
  ctx.lineTo(w, h * 0.6);
  ctx.fill();

  if (prompt) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    ctx.fillText(prompt.substring(0, 30), w / 2, h - 20);
  }
}

function generateCartoon(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  prompt: string,
): void {
  ctx.fillStyle = "#FFB6C1";
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "#FF69B4";
  ctx.beginPath();
  ctx.arc(w * 0.3, h * 0.3, 60, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#87CEEB";
  ctx.fillRect(w * 0.6, h * 0.3, 80, 100);

  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(w * 0.25, h * 0.25, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(w * 0.35, h * 0.25, 10, 0, Math.PI * 2);
  ctx.fill();

  if (prompt) {
    ctx.fillStyle = "#000";
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "center";
    ctx.fillText(prompt.substring(0, 25), w / 2, h - 30);
  }
}

function generateWatercolor(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  prompt: string,
): void {
  const colors = ["#FF6B9D", "#C44569", "#FFA502", "#26C485", "#5DADE2"];

  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = colors[i];
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(
      Math.random() * w,
      Math.random() * h,
      Math.random() * 100 + 50,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  if (prompt) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.font = "italic 20px Georgia";
    ctx.textAlign = "center";
    ctx.fillText(prompt.substring(0, 30), w / 2, h / 2);
  }
}

function generateAbstract(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  _prompt: string,
): void {
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = `hsl(${Math.random() * 360}, 100%, 50%)`;
    ctx.globalAlpha = Math.random() * 0.7 + 0.3;

    if (Math.random() > 0.5) {
      ctx.beginPath();
      ctx.arc(
        Math.random() * w,
        Math.random() * h,
        Math.random() * 50,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    } else {
      ctx.fillRect(
        Math.random() * w,
        Math.random() * h,
        Math.random() * 100,
        Math.random() * 100,
      );
    }
  }

  ctx.globalAlpha = 1;
  ctx.fillStyle = "#333";
  ctx.font = "16px Courier";
  ctx.textAlign = "center";
  ctx.fillText("ABSTRACT", w / 2, 30);
}

function generate3D(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  prompt: string,
): void {
  const gradient1 = ctx.createLinearGradient(0, 0, w, h);
  gradient1.addColorStop(0, "#1a1a2e");
  gradient1.addColorStop(1, "#16213e");
  ctx.fillStyle = gradient1;
  ctx.fillRect(0, 0, w, h);

  drawFaux3DBox(ctx, w * 0.2, h * 0.2, 100, "#FF6B6B");
  drawFaux3DBox(ctx, w * 0.6, h * 0.3, 120, "#4ECDC4");

  if (prompt) {
    ctx.fillStyle = "#00D9FF";
    ctx.font = "bold 20px Arial";
    ctx.textAlign = "center";
    ctx.fillText(prompt.substring(0, 20), w / 2, h - 30);
  }
}

function drawFaux3DBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, size, size);

  ctx.fillStyle = colorLighten(color, 0.3);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 20, y - 20);
  ctx.lineTo(x + size + 20, y - 20);
  ctx.lineTo(x + size, y);
  ctx.fill();

  ctx.fillStyle = colorDarken(color, 0.3);
  ctx.beginPath();
  ctx.moveTo(x + size, y);
  ctx.lineTo(x + size + 20, y - 20);
  ctx.lineTo(x + size + 20, y + size - 20);
  ctx.lineTo(x + size, y + size);
  ctx.fill();
}

function colorLighten(color: string, percent: number): string {
  const num = parseInt(color.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  return (
    "#" +
    (0x1000000 + (num > 0xffffff ? 0xffffff : num + amt * 0x10101))
      .toString(16)
      .slice(1)
  );
}

function colorDarken(color: string, percent: number): string {
  const num = parseInt(color.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  return (
    "#" +
    (0x1000000 + (num < amt ? 0 : num - amt * 0x10101)).toString(16).slice(1)
  );
}