import { type DrawableElement } from '../types';
import { AtmosphereManager } from '../managers/AtmosphereManager';

export class Cloud implements DrawableElement {
  private segments: Array<{
    x: number;
    y: number;
    radius: number;
    density: number;
    drift: number;
    height: number; // Add height variation
  }> = [];
  private baseY: number;
  private cloudType: 'high' | 'medium' | 'low';

  constructor(
    private x: number,
    private y: number,
    private width: number,
    private atmosphereManager: AtmosphereManager
  ) {
    // Randomly assign cloud type with weighted distribution
    const rand = Math.random();
    this.cloudType = rand < 0.4 ? 'low' : rand < 0.7 ? 'medium' : 'high';
    
    // Adjust y position based on cloud type
    const heightFactor = this.cloudType === 'low' ? 0.6 : 
                        this.cloudType === 'medium' ? 0.4 : 0.25;
    this.baseY = y * heightFactor;
    this.y = this.baseY;
    this.width = width * (0.5 + Math.random() * 0.6); // Increase base width
    this.createSegments();
  }

  private createSegments() {
    // Increase number of segments for each cloud type
    const numSegments = this.cloudType === 'low' ? 12 + Math.floor(Math.random() * 4) :
                       this.cloudType === 'medium' ? 8 + Math.floor(Math.random() * 4) :
                       6 + Math.floor(Math.random() * 3);

    for (let i = 0; i < numSegments; i++) {
      const heightVariation = this.cloudType === 'low' ? 15 :
                            this.cloudType === 'medium' ? 10 : 6;
      
      // Increase radius ranges
      const baseRadius = this.cloudType === 'low' ? 15 : 
                        this.cloudType === 'medium' ? 12 : 10;
      
      this.segments.push({
        x: (i / numSegments) * this.width + (Math.random() - 0.5) * 40,
        y: Math.random() * heightVariation - heightVariation/2,
        radius: (baseRadius + Math.random() * 10) * 
               (this.cloudType === 'low' ? 1.3 : 
                this.cloudType === 'medium' ? 1.1 : 0.9),
        density: 0.5 + Math.random() * 0.5,
        drift: Math.random() * Math.PI * 2,
        height: Math.random() * heightVariation
      });
    }
  }

  update(wind: number) {
    const time = Date.now() / 1000;
    // Different wind effects based on height
    const windEffect = this.cloudType === 'high' ? wind * 0.8 :
                      this.cloudType === 'medium' ? wind * 0.5 :
                      wind * 0.3;
    
    this.x += windEffect;
    
    // Wrap around screen edges
    if (this.x < -this.width) this.x = window.innerWidth + this.width;
    if (this.x > window.innerWidth + this.width) this.x = -this.width;

    // More varied vertical drift based on cloud type
    this.segments.forEach(segment => {
      segment.y = Math.sin(time + segment.drift) * segment.height;
    });
    this.y = this.baseY + Math.sin(time * 0.5) * 2;
  }

  draw(ctx: CanvasRenderingContext2D) {
    const atmosphericFactor = this.atmosphereManager.getAtmosphericFactor(this.y);
    const lightColor = this.atmosphereManager.getLightColor();
    const timeOfDay = this.atmosphereManager.getTimeOfDay();
    
    // Adjust cloud appearance based on time of day
    const dayPhase = timeOfDay < 0.25 ? 'dawn' :
                    timeOfDay < 0.75 ? 'day' :
                    timeOfDay < 0.85 ? 'dusk' : 'night';

    ctx.save();
    ctx.globalCompositeOperation = dayPhase === 'night' ? 'screen' : 'lighter';

    // Draw main cloud body
    this.segments.forEach(segment => {
      const gradient = ctx.createRadialGradient(
        this.x + segment.x,
        this.y + segment.y,
        0,
        this.x + segment.x,
        this.y + segment.y,
        segment.radius
      );

      // Adjust colors based on time of day
      let cloudColor, edgeColor;
      switch(dayPhase) {
        case 'dawn':
          cloudColor = `rgba(255,240,230,${0.8 * segment.density * atmosphericFactor})`;
          edgeColor = `rgba(255,200,180,${0.4 * segment.density * atmosphericFactor})`;
          break;
        case 'day':
          cloudColor = `rgba(255,255,255,${0.9 * segment.density * atmosphericFactor})`;
          edgeColor = `rgba(255,255,255,${0.3 * segment.density * atmosphericFactor})`;
          break;
        case 'dusk':
          cloudColor = `rgba(255,210,180,${0.8 * segment.density * atmosphericFactor})`;
          edgeColor = `rgba(255,180,160,${0.4 * segment.density * atmosphericFactor})`;
          break;
        case 'night':
          cloudColor = `rgba(40,40,60,${0.6 * segment.density * atmosphericFactor})`;
          edgeColor = `rgba(20,20,40,${0.2 * segment.density * atmosphericFactor})`;
          break;
      }

      gradient.addColorStop(0, cloudColor);
      gradient.addColorStop(0.4, cloudColor);
      gradient.addColorStop(0.7, edgeColor);
      gradient.addColorStop(1, 'rgba(255,255,255,0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(
        this.x + segment.x,
        this.y + segment.y,
        segment.radius,
        0,
        Math.PI * 2
      );
      ctx.fill();
    });

    ctx.restore();
  }
}