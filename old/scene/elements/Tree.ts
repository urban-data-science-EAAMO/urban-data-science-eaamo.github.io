import { type DrawableElement } from '../types';
import { Branch } from './Branch';

export class Tree implements DrawableElement {
  private branches: Branch[] = [];
  private lastUpdateTime = 0;
  private readonly UPDATE_INTERVAL = 50; // ms
  private birchMarkings: Array<{x: number, y: number, width: number, height: number}> = [];

  constructor(
    private x: number,
    private y: number,
    private height: number,
    private rowIndex: number, // Add row index
    private atmosphereManager?: AtmosphereManager
  ) {
    this.height = height;
    this.createBranches();
    this.generateBirchMarkings();
  }

  // Add getter for row index
  public getRowIndex(): number {
    return this.rowIndex;
  }

  private generateBirchMarkings() {
    this.birchMarkings = [];
    const trunkWidth = this.height * 0.04; // Match the thinner trunk width
    
    // Generate more visible markings
    for (let i = 0; i < this.height; i += 15) { // More frequent markings
      if (Math.random() > 0.6) continue; // More markings
      
      this.birchMarkings.push({
        x: this.x - trunkWidth/2 + Math.random() * trunkWidth, // Absolute position
        y: this.y - i, // Absolute position
        width: trunkWidth * (0.4 + Math.random() * 0.4), // Wider markings
        height: 3 + Math.random() * 4 // Slightly taller markings
      });
    }
  }

  private isValidBranchAngle(angle: number): boolean {
    // Convert angle to degrees for easier reasoning
    const degrees = (angle * 180 / Math.PI) % 360;
    
    // Avoid branches pointing downward (between 30 and -30 degrees from horizontal)
    return !((degrees > 60 && degrees < 120) || 
             (degrees > 240 && degrees < 300));
  }

  private createBranches() {
    const trunkHeight = this.height * 0.95;
    // Start branches higher up the trunk
    const branchStartHeight = this.height * 0.5;

    // Main branches - focus on upper portion of tree
    const numMainBranches = 5;
    let mainBranchCount = 0;
    let attempt = 0;
    
    while (mainBranchCount < numMainBranches && attempt < 20) {
      const angle = ((attempt * Math.PI) / 4) - Math.PI/4;
      if (this.isValidBranchAngle(angle)) {
        const heightPercent = 0.6 + (mainBranchCount * 0.08); // More spread out
        // Ensure branches don't exceed trunk height
        const branchHeight = Math.min(trunkHeight * heightPercent, this.height * 0.95);
        this.branches.push(new Branch(
          this.height * 0.2,
          angle,
          branchHeight,
          'main'
        ));
        mainBranchCount++;
      }
      attempt++;
    }

    // Secondary branches
    const numSecondaryBranches = 6;
    for (let i = 0; i < numSecondaryBranches * 2; i++) {
      const angle = (i * Math.PI / numSecondaryBranches) + (Math.random() * 0.2 - 0.1);
      
      if (this.isValidBranchAngle(angle)) {
        const heightPercent = 0.5 + (Math.random() * 0.4); // More spread out
        // Ensure branches don't exceed trunk height
        const branchHeight = Math.min(trunkHeight * heightPercent, this.height * 0.9);
        this.branches.push(new Branch(
          this.height * 0.15,
          angle,
          branchHeight,
          'secondary'
        ));
      }
    }

    // Small branches
    const numSmallBranches = 8; // Reduced number
    for (let i = 0; i < numSmallBranches * 2; i++) {
      const angle = (i * Math.PI / numSmallBranches) + (Math.random() * 0.3 - 0.15);
      
      if (this.isValidBranchAngle(angle)) {
        const heightPercent = 0.45 + (Math.random() * 0.45); // More spread
        // Ensure branches don't exceed trunk height
        const branchHeight = Math.min(trunkHeight * heightPercent, this.height * 0.85);
        this.branches.push(new Branch(
          this.height * 0.1,
          angle,
          branchHeight,
          'small'
        ));
      }
    }
  }

  update(wind: number) {
    const now = performance.now();
    if (now - this.lastUpdateTime < this.UPDATE_INTERVAL) return;
    
    this.branches.forEach(branch => branch.update(wind));
    this.lastUpdateTime = now;
  }

  draw(ctx: CanvasRenderingContext2D) {
    const trunkWidth = this.height * 0.04; // Thinner trunk
    
    ctx.save();
    
    // Draw trunk
    const gradient = ctx.createLinearGradient(
      this.x - trunkWidth, this.y,
      this.x + trunkWidth, this.y
    );
    gradient.addColorStop(0, '#E8E8E8');
    gradient.addColorStop(0.2, '#F5F5F5');
    gradient.addColorStop(0.8, '#F5F5F5');
    gradient.addColorStop(1, '#E8E8E8');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(this.x - trunkWidth, this.y);
    ctx.lineTo(this.x - trunkWidth/4, this.y - this.height);
    ctx.lineTo(this.x + trunkWidth/4, this.y - this.height);
    ctx.lineTo(this.x + trunkWidth, this.y);
    ctx.closePath();
    ctx.fill();

    // Draw birch markings more visibly
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; // Darker markings
    this.birchMarkings.forEach(mark => {
      ctx.fillRect(
        mark.x - this.x, // Adjust for context translation
        mark.y - this.y,
        mark.width,
        mark.height
      );
    });
    
    ctx.restore();

    // Draw branches within trunk bounds
    this.branches
      .forEach(branch => {
        if (branch.startHeight <= this.height) {
          branch.draw(ctx, this.x, this.y - branch.startHeight);
        }
      });
  }
}