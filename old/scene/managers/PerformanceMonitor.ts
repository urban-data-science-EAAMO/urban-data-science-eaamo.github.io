export class PerformanceMonitor {
  private frameCount = 0;
  private lastTime = 0;
  private fps = 60; // Start with assumed good performance
  private frameTime = 0;
  private maxFrameTime = 0;
  private readings: number[] = []; // Store last 10 readings
  private readonly SAMPLE_SIZE = 10;

  measure(timestamp: number) {
    const currentFrameTime = performance.now();
    this.frameTime = currentFrameTime - this.lastTime;
    this.maxFrameTime = Math.max(this.maxFrameTime, this.frameTime);
    
    this.readings.push(this.frameTime);
    if (this.readings.length > this.SAMPLE_SIZE) {
      this.readings.shift();
    }
    
    this.frameCount++;
    if (timestamp - this.lastTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastTime = timestamp;
    }
  }

  get currentFPS() { return this.fps; }
  get currentFrameTime() { return this.frameTime; }
  get peakFrameTime() { return this.maxFrameTime; }
  get isLowPerformance() { 
    // Only consider low performance if consistently bad
    const avgFrameTime = this.readings.reduce((a, b) => a + b, 0) / this.readings.length;
    return this.fps < 25 && avgFrameTime > 40;
  }
}