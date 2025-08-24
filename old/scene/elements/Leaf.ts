import { type DrawableElement } from '../types';

export class Leaf implements DrawableElement {
  private rotation = Math.random() * Math.PI * 2;
  private rotationSpeed = (Math.random() - 0.5) * 0.1;
  private fallSpeed = 1 + Math.random();

  constructor(
    private x: number,
    private y: number,
    private size: number
  ) {}

  update(wind: number) {
    this.x += wind * 2;
    this.y += this.fallSpeed;
    this.rotation += this.rotationSpeed + (wind * 0.1);
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    
    ctx.fillStyle = '#228B22';
    ctx.beginPath();
    ctx.ellipse(0, 0, this.size, this.size / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }

  isOnScreen(height: number): boolean {
    return this.y < height + 50;
  }
}