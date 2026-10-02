import {useLayoutEffect, useRef} from 'react';
import type {Spark} from './choreography';
export const Sparks = ({sparks, opacity}: {sparks: Spark[]; opacity: number}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d'); if (!ctx) return;
    ctx.clearRect(0, 0, 1080, 1080);
    ctx.save(); ctx.translate(540, 540); ctx.globalCompositeOperation = 'screen';
    for (const p of sparks) {
      ctx.globalAlpha = p.alpha * opacity;
      ctx.strokeStyle = p.color; ctx.fillStyle = p.color; ctx.lineWidth = p.size;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 12, p.y - p.vy * 12); ctx.stroke();
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.restore();
  }, [sparks, opacity]);
  return <canvas ref={ref} width={1080} height={1080} style={{position: 'absolute', inset: 0}}/>;
};
