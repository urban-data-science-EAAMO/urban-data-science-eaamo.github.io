import { type DrawableElement } from '../types';

export class Branch implements DrawableElement {
  private currentAngle: number;
  private swayOffset: number;
  private swaySpeed: number;
  private leafClusters: Array<{ x: number; y: number; size: number }> = [];

  constructor(
    private length: number,
    private baseAngle: number,
    public startHeight: number,
    private type: 'main' | 'secondary' | 'small'
  ) {
    this.currentAngle = baseAngle;
    this.swayOffset = Math.random() * Math.PI * 2;
    this.swaySpeed = 0.3 + Math.random() * 0.3;

    // Fewer leaf clusters
    const numClusters = type === 'main' ? 3 : 
                       type === 'secondary' ? 2 : 1;
    
    for (let i = 0; i < numClusters; i++) {
      const distanceAlongBranch = (i + 1) / (numClusters + 1);
      this.leafClusters.push({
        x: Math.cos(baseAngle) * (length * distanceAlongBranch),
        y: Math.sin(baseAngle) * (length * distanceAlongBranch),
        size: type === 'main' ? 25 :
              type === 'secondary' ? 20 : 15
      });
    }
  }

  update(wind: number) {
    const time = Date.now() / 1000;
    const swayAmount = this.type === 'small' ? 0.15 : 
                      this.type === 'secondary' ? 0.1 : 0.05;
    
    this.currentAngle = this.baseAngle + 
      Math.sin(time * this.swaySpeed + this.swayOffset) * 
      wind * swayAmount;
  }

  draw(ctx: CanvasRenderingContext2D, startX: number, startY: number) {
    // Draw branch
    ctx.strokeStyle = '#E8E8E8'; // Birch-like color
    ctx.lineWidth = this.type === 'main' ? 8 :
                    this.type === 'secondary' ? 5 : 3;
    
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    const endX = startX + Math.cos(this.currentAngle) * this.length;
    const endY = startY + Math.sin(this.currentAngle) * this.length;
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // Draw leaf clusters
    this.leafClusters.forEach(cluster => {
      const leafX = startX + cluster.x;
      const leafY = startY + cluster.y;

      // Smaller, more delicate leaf clusters
      const gradient = ctx.createRadialGradient(
        leafX, leafY, 0,
        leafX, leafY, cluster.size
      );
      gradient.addColorStop(0, '#93C572');  // Lighter green
      gradient.addColorStop(0.6, '#739659'); // Birch leaf green
      gradient.addColorStop(1, '#5B7444');   // Darker edge

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(leafX, leafY, cluster.size, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}