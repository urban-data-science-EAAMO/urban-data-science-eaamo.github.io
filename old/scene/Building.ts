import { type DrawableElement } from './types';
import { AtmosphereManager } from './managers/AtmosphereManager';

export class Building implements DrawableElement {
  private stoneworkPattern: ImageData | null = null;
  private stoneworkCanvas: HTMLCanvasElement | null = null; // Add this line
  private windowGlow: CanvasGradient | null = null;
  private readonly depth: number;  // Add depth as class property
  private readonly atmosphereManager: AtmosphereManager; // Add this line

  constructor(
    private x: number,
    private y: number,
    private z: number,
    private width: number,
    private height: number,
    atmosphereManager: AtmosphereManager // Remove private
  ) {
    this.depth = this.width * 0.3;  // Initialize depth
    this.generateStoneworkPattern();
    this.windowGlow = this.createWindowGlow();
    this.atmosphereManager = atmosphereManager; // Add this line
  }

  private generateStoneworkPattern() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 50;
    canvas.height = 50;
    
    // Base stone color
    ctx.fillStyle = '#686868';
    ctx.fillRect(0, 0, 50, 50);

    // Create varied stone blocks
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 3; col++) {
        const x = col * 17;
        const y = row * 13;
        const width = 15;
        const height = 11;

        // Stone base
        ctx.fillStyle = `rgb(${90 + Math.random() * 20}, ${90 + Math.random() * 20}, ${90 + Math.random() * 20})`;
        ctx.fillRect(x, y, width, height);

        // Stone texture
        ctx.fillStyle = `rgba(40, 40, 40, 0.1)`;
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.arc(
            x + Math.random() * width,
            y + Math.random() * height,
            1 + Math.random() * 2,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }

        // Stone edges
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, width, height);
      }
    }

    this.stoneworkPattern = ctx.getImageData(0, 0, 50, 50);

    // Create a separate canvas to hold the ImageData
    this.stoneworkCanvas = document.createElement('canvas');
    this.stoneworkCanvas.width = 50;
    this.stoneworkCanvas.height = 50;
    const patternCtx = this.stoneworkCanvas.getContext('2d');
    if (patternCtx) {
      patternCtx.putImageData(this.stoneworkPattern, 0, 0);
    }
  }

  private createWindowGlow(): CanvasGradient | null {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    canvas.width = 100;
    canvas.height = 100;

    const gradient = ctx.createRadialGradient(
      50, 50, 5,
      50, 50, 50
    );
    gradient.addColorStop(0, 'rgba(255, 240, 200, 0.8)');
    gradient.addColorStop(1, 'rgba(255, 240, 200, 0)');

    return gradient;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // Draw the main structure
    this.drawMainStructure(ctx);

    // Draw the towers
    this.drawTowers(ctx);

    // Draw architectural details
    this.drawArches(ctx);
    this.drawButtresses(ctx);
    this.drawTracery(ctx);

    // Draw windows
    this.drawWindows(ctx);

    // Add lighting and shadows
    this.addLighting(ctx);
    this.addShadows(ctx);

    ctx.restore();
  }

  private drawMainStructure(ctx: CanvasRenderingContext2D) {
    const { x: isoXLeft, y: isoYLeft } = this.isometricProjection(0, 0, 0);
    const { x: isoXRight, y: isoYRight } = this.isometricProjection(this.width, 0, 0);
    const { x: isoXBack, y: isoYBack } = this.isometricProjection(this.width, 0, this.depth);
    const { x: isoXLeftBack, y: isoYLeftBack } = this.isometricProjection(0, 0, this.depth);
    const { x: isoXTopLeft, y: isoYTopLeft } = this.isometricProjection(0, this.height, 0);
    const { x: isoXTopRight, y: isoYTopRight } = this.isometricProjection(this.width, this.height, 0);
    const { x: isoXTopBack, y: isoYTopBack } = this.isometricProjection(this.width, this.height, this.depth);
    const { x: isoXTopLeftBack, y: isoYTopLeftBack } = this.isometricProjection(0, this.height, this.depth);

    // Draw left wall
    ctx.beginPath();
    ctx.moveTo(isoXLeft, isoYLeft);
    ctx.lineTo(isoXTopLeft, isoYTopLeft);
    ctx.lineTo(isoXTopLeftBack, isoYTopLeftBack);
    ctx.lineTo(isoXLeftBack, isoYLeftBack);
    ctx.closePath();
    this.applyStoneworkPattern(ctx);
    ctx.fill();

    // Draw right wall
    ctx.beginPath();
    ctx.moveTo(isoXRight, isoYRight);
    ctx.lineTo(isoXTopRight, isoYTopRight);
    ctx.lineTo(isoXTopBack, isoYTopBack);
    ctx.lineTo(isoXBack, isoYBack);
    ctx.closePath();
    this.applyStoneworkPattern(ctx);
    ctx.fill();

    // Draw roof
    ctx.beginPath();
    ctx.moveTo(isoXTopLeft, isoYTopLeft);
    ctx.lineTo(isoXTopRight, isoYTopRight);
    ctx.lineTo(isoXTopBack, isoYTopBack);
    ctx.lineTo(isoXTopLeftBack, isoYTopLeftBack);
    ctx.closePath();
    ctx.fillStyle = '#4A4A4A';
    ctx.fill();
  }

  private drawTowers(ctx: CanvasRenderingContext2D) {
    const towerBaseWidth = this.width * 0.2;
    const towerHeight = this.height * 0.6;
    const towerDepth = this.depth * 0.4;

    // Left tower
    this.drawTower(ctx, -towerBaseWidth * 0.3, towerHeight, -towerDepth * 0.3, towerBaseWidth, towerHeight, towerDepth);

    // Right tower
    this.drawTower(ctx, this.width - towerBaseWidth * 0.7, towerHeight, this.depth - towerDepth * 0.7, towerBaseWidth, towerHeight, towerDepth);
  }

  private drawTower(ctx: CanvasRenderingContext2D, x: number, y: number, z: number, width: number, height: number, depth: number) {
    const { x: isoXLeft, y: isoYLeft } = this.isometricProjection(x, 0, z);
    const { x: isoXRight, y: isoYRight } = this.isometricProjection(x + width, 0, z);
    const { x: isoXBack, y: isoYBack } = this.isometricProjection(x + width, 0, z + depth);
    const { x: isoXLeftBack, y: isoYLeftBack } = this.isometricProjection(x, 0, z + depth);
    const { x: isoXTopLeft, y: isoYTopLeft } = this.isometricProjection(x, height, z);
    const { x: isoXTopRight, y: isoYTopRight } = this.isometricProjection(x + width, height, z);
    const { x: isoXTopBack, y: isoYTopBack } = this.isometricProjection(x + width, height, z + depth);
    const { x: isoXTopLeftBack, y: isoYTopLeftBack } = this.isometricProjection(x, height, z + depth);

    // Draw left wall
    ctx.beginPath();
    ctx.moveTo(isoXLeft, isoYLeft);
    ctx.lineTo(isoXTopLeft, isoYTopLeft);
    ctx.lineTo(isoXTopLeftBack, isoYTopLeftBack);
    ctx.lineTo(isoXLeftBack, isoYLeftBack);
    ctx.closePath();
    this.applyStoneworkPattern(ctx);
    ctx.fill();

    // Draw right wall
    ctx.beginPath();
    ctx.moveTo(isoXRight, isoYRight);
    ctx.lineTo(isoXTopRight, isoYTopRight);
    ctx.lineTo(isoXTopBack, isoYTopBack);
    ctx.lineTo(isoXBack, isoYBack);
    ctx.closePath();
    this.applyStoneworkPattern(ctx);
    ctx.fill();

    // Draw roof
    ctx.beginPath();
    ctx.moveTo(isoXTopLeft, isoYTopLeft);
    ctx.lineTo(isoXTopRight, isoYTopRight);
    ctx.lineTo(isoXTopBack, isoYTopBack);
    ctx.lineTo(isoXTopLeftBack, isoYTopLeftBack);
    ctx.closePath();
    ctx.fillStyle = '#5A5A5A';
    ctx.fill();
  }

  private drawArches(ctx: CanvasRenderingContext2D) {
    const archWidth = this.width * 0.3;
    const archHeight = this.height * 0.2;
    const archDepth = this.depth * 0.3;

    // Left arch
    this.drawArch(ctx, this.width * 0.1, archHeight, archWidth, archHeight, archDepth);

    // Right arch
    this.drawArch(ctx, this.width * 0.6, archHeight, archWidth, archHeight, archDepth);
  }

  private drawArch(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, depth: number) {
    const { x: isoXLeft, y: isoYLeft } = this.isometricProjection(x, 0, 0);
    const { x: isoXRight, y: isoYRight } = this.isometricProjection(x + width, 0, 0);
    const { x: isoXTop, y: isoYTop } = this.isometricProjection(x + width / 2, height, 0);

    ctx.beginPath();
    ctx.moveTo(isoXLeft, isoYLeft);
    ctx.quadraticCurveTo(isoXTop, isoYTop - height * 0.5, isoXRight, isoYRight);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private drawButtresses(ctx: CanvasRenderingContext2D) {
    const buttressWidth = this.width * 0.05;
    const buttressHeight = this.height * 0.4;
    const buttressDepth = this.depth * 0.05;

    // Left buttress
    this.drawButtress(ctx, buttressWidth, buttressHeight, buttressDepth);

    // Right buttress
    this.drawButtress(ctx, this.width - buttressWidth * 2, buttressHeight, buttressDepth);
  }

  private drawButtress(ctx: CanvasRenderingContext2D, x: number, y: number, depth: number) {
    const { x: isoXBottom, y: isoYBottom } = this.isometricProjection(x, 0, 0);
    const { x: isoXTop, y: isoYTop } = this.isometricProjection(x, y, 0);
    const { x: isoXDepth, y: isoYDepth } = this.isometricProjection(x, 0, depth);

    ctx.beginPath();
    ctx.moveTo(isoXBottom, isoYBottom);
    ctx.lineTo(isoXTop, isoYTop);
    ctx.lineTo(isoXDepth, isoYDepth);
    ctx.closePath();
    ctx.fillStyle = '#555';
    ctx.fill();
  }

  private drawTracery(ctx: CanvasRenderingContext2D) {
    const traceryWidth = this.width * 0.1;
    const traceryHeight = this.height * 0.3;

    // Left tracery
    this.drawTraceryDetail(ctx, traceryWidth, traceryHeight);

    // Right tracery
    this.drawTraceryDetail(ctx, this.width - traceryWidth * 2, traceryHeight);
  }

  private drawTraceryDetail(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const { x: isoXBottom, y: isoYBottom } = this.isometricProjection(x, 0, 0);
    const { x: isoXTop, y: isoYTop } = this.isometricProjection(x, y, 0);

    ctx.beginPath();
    ctx.moveTo(isoXBottom, isoYBottom);
    ctx.lineTo(isoXTop, isoYTop);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  private drawWindows(ctx: CanvasRenderingContext2D) {
    const windowWidth = this.width * 0.15;
    const windowHeight = this.height * 0.25;
    const windowDepth = this.depth * 0.15;

    // Left window
    this.drawWindow(ctx, this.width * 0.1, windowHeight, windowWidth, windowHeight, windowDepth);

    // Right window
    this.drawWindow(ctx, this.width * 0.6, windowHeight, windowWidth, windowHeight, windowDepth);
  }

  private drawWindow(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, depth: number) {
    const { x: isoXLeft, y: isoYLeft } = this.isometricProjection(x, y, 0);
    const { x: isoXRight, y: isoYRight } = this.isometricProjection(x + width, y, 0);
    const { x: isoXTopLeft, y: isoYTopLeft } = this.isometricProjection(x, y + height, 0);
    const { x: isoXTopRight, y: isoYTopRight } = this.isometricProjection(x + width, y + height, 0);

    // Draw window glass
    ctx.fillStyle = '#87CEEB'; // Light blue color for the glass
    ctx.beginPath();
    ctx.moveTo(isoXLeft, isoYLeft);
    ctx.lineTo(isoXRight, isoYRight);
    ctx.lineTo(isoXTopRight, isoYTopRight);
    ctx.lineTo(isoXTopLeft, isoYTopLeft);
    ctx.closePath();
    ctx.fill();

    // Draw window frame
    ctx.strokeStyle = '#222'; // Dark color for the frame
    ctx.lineWidth = 1;
    ctx.strokeRect(isoXLeft, isoYLeft, isoXRight - isoXLeft, isoYTopLeft - isoYLeft);
  }

  private addLighting(ctx: CanvasRenderingContext2D) {
    // Get light direction from AtmosphereManager
    const lightDirection = this.atmosphereManager.getLightDirection();

    // Calculate light intensity based on the angle of the surface
    const lightIntensity = Math.cos(lightDirection);

    // Apply lighting to the walls
    ctx.fillStyle = `rgba(255, 255, 255, ${lightIntensity * 0.2})`;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  private addShadows(ctx: CanvasRenderingContext2D) {
    // Get shadow color from AtmosphereManager
    const shadowColor = this.atmosphereManager.getShadowColor();

    // Apply shadows to the walls
    ctx.fillStyle = shadowColor;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  private applyStoneworkPattern(ctx: CanvasRenderingContext2D) {
    if (!this.stoneworkCanvas) return;
    ctx.fillStyle = ctx.createPattern(this.stoneworkCanvas, 'repeat') || '#808080';
  }

  // Isometric projection function
  private isometricProjection(x: number, y: number, z: number): { x: number; y: number } {
    const isoX = x - z;
    const isoY = (x + z) / 2 - y;
    return { x: isoX, y: isoY };
  }
}