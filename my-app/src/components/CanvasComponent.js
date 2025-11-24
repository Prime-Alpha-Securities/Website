import React, { useEffect, useRef } from 'react';

const CanvasComponent = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    // Draw something on the canvas
    context.fillStyle = 'red';
    context.fillRect(0, 0, canvas.width, canvas.height);

    return () => {
      // Cleanup or cancel any ongoing rendering operations if necessary
      // This is crucial if you have ongoing animation or rendering logic
    };
  }, []);

  return <canvas ref={canvasRef} width={500} height={500}></canvas>;
};

export default CanvasComponent;

