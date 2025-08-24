export class AtmosphereManager {
  private timeOfDay = this.getCurrentTimeOfDay(); // Initialize to current time of day
  private readonly DAY_DURATION = 300000;
  private readonly COLORS = {
    dawn: {
      sky: ['#24304A', '#6BB2D4', '#A7D1AB'], // Fragonard-inspired with cyberpunk accents
      light: '#FFDAC1', // Soft, warm light
      shadow: '#334756', // Deep, muted shadow
      cloud: {
        base: 'rgba(255,240,230,0.6)', // Softer clouds
        edge: 'rgba(255,200,180,0.2)'
      }
    },
    day: {
      sky: ['#90AFC5', '#336B87', '#2A3132'], // Fragonard-inspired with cyberpunk accents
      light: '#FFFFFF', // Bright, diffused light
      shadow: '#2F4F4F', // Muted shadow
      cloud: {
        base: 'rgba(255,255,255,0.7)', // Softer clouds
        edge: 'rgba(255,255,255,0.1)'
      }
    },
    dusk: {
      sky: ['#4A4A6B', '#FF7F50', '#E0BBE4'], // Fragonard-inspired with cyberpunk accents
      light: '#FFA07A', // Warm, glowing light
      shadow: '#483D8B', // Deep, muted shadow
      cloud: {
        base: 'rgba(255,210,180,0.6)', // Softer clouds
        edge: 'rgba(255,180,160,0.2)'
      }
    },
    night: {
      sky: ['#0C1445', '#1B2431', '#2C3E50'], // Tron-inspired
      light: '#2C3E50', // Muted light
      shadow: '#000000', // Deep shadow
      cloud: {
        base: 'rgba(44,62,80,0.2)', // Softer clouds
        edge: 'rgba(30,42,54,0.1)'
      }
    }
  };

  constructor(
    private width: number, 
    private height: number,
    private lowPerformanceMode: boolean = false
  ) {}

  private getCurrentTimeOfDay(): number {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    // Convert to decimal time (0-1)
    return (hours * 60 + minutes) / (24 * 60);
  }

  update(timestamp: number) {
    // Update every minute
    if (timestamp % 60000 < 16.67) { // Update on frame closest to minute change
      this.timeOfDay = this.getCurrentTimeOfDay();
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    // Base sky gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    const colors = this.getCurrentPalette();
    
    colors.sky.forEach((color, index) => {
      gradient.addColorStop(index / (colors.sky.length - 1), color);
    });

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);

    // Add atmospheric perspective with safe opacity values
    if (!this.lowPerformanceMode) {
      const depthGradient = ctx.createLinearGradient(0, 0, 0, this.height);
      // Ensure haze value is always a number between 0 and 1
      const timeRadians = this.timeOfDay * Math.PI;
      const haze = Math.max(0, Math.min(1, (Math.sin(timeRadians) + 1) / 2));
      
      depthGradient.addColorStop(0, 'rgba(255,255,255,0)');
      depthGradient.addColorStop(0.7, `rgba(255,255,255,${0.10 * haze})`); // Reduced haze intensity
      depthGradient.addColorStop(1, `rgba(255,255,255,${0.20 * haze})`); // Reduced haze intensity
      
      ctx.fillStyle = depthGradient;
      ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  private getCurrentPalette() {
    if (this.timeOfDay < 0.25) return this.COLORS.dawn;
    if (this.timeOfDay < 0.75) return this.COLORS.day;
    return this.COLORS.dusk;
  }

  getLightDirection(): number {
    return Math.PI * 2 * this.timeOfDay - Math.PI / 2;
  }

  getLightColor(): string {
    return this.getCurrentPalette().light;
  }

  getShadowColor(): string {
    return this.getCurrentPalette().shadow;
  }

  getAtmosphericFactor(y: number): number {
    return Math.max(0, Math.min(1, (this.height - y) / this.height * 1.5));
  }

  getTimeOfDay(): number {
    return this.timeOfDay;
  }
}