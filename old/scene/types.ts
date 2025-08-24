export interface DrawableElement {
  draw(ctx: CanvasRenderingContext2D): void;
  update?(wind: number): void;
}

export interface SceneConfig {
  width: number;
  height: number;
  lowPerformanceMode: boolean;
  TARGET_FPS: number;
  FRAME_INTERVAL: number;
}