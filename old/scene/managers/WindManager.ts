export class WindManager {
  private current = 0;
  private target = 0;
  private speed = 0.002; // Doubled for more responsive wind changes
  private changeTimer = 0;
  private readonly MAX_WIND_STRENGTH = 1.2; // Increased max wind strength

  update() {
    if (--this.changeTimer <= 0) {
      // Increased wind range from -0.5/0.5 to -1.2/1.2
      this.target = (Math.random() - 0.5) * this.MAX_WIND_STRENGTH;
      // Shorter intervals between wind changes
      this.changeTimer = 300 + Math.random() * 400;
    }
    
    this.current += (this.target - this.current) * this.speed;
  }

  get strength() {
    // Add subtle oscillation to the wind
    return this.current + Math.sin(Date.now() / 1000) * 0.1;
  }
}