import React, { useRef, useEffect } from 'react';
import { PixelScene } from '../utils/pixelScene';

const PixelSceneComponent: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const pixelScene = new PixelScene(canvasRef.current);
    pixelScene.init();

    return () => {
      pixelScene.cleanup();
    };
  }, []);

  return <canvas ref={canvasRef} width={window.innerWidth} height={window.innerHeight} style={{ position: 'fixed', top: 0, left: 0, zIndex: -1 }} />;
};

export default PixelSceneComponent;