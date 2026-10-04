import { useRef, useEffect, useState } from 'react';
import { FaceLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';

interface Props {
  isTalking: boolean;
}

export default function AvatarCanvas({ isTalking }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [faceLandmarker, setFaceLandmarker] = useState<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );

        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU"
          },
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          numFaces: 1,
          runningMode: 'VIDEO'
        });

        setFaceLandmarker(landmarker);
        setIsLoaded(true);
        setError(null);
      } catch (err) {
        setError("MediaPipe load failed - falling back to enhanced canvas");
        console.error(err);
      }
    };

    initMediaPipe();

    return () => {
      if (faceLandmarker) faceLandmarker.close();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    canvas.width = 320;
    canvas.height = 320;

    let frame = 0;
    let animationFrame: number;

    const animate = async () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Premium head base with CEO energy
      ctx.fillStyle = '#1f2937';
      ctx.beginPath();
      ctx.arc(160, 160, 130, 0, Math.PI * 2);
      ctx.fill();

      const grad = ctx.createRadialGradient(115, 115, 45, 160, 165, 125);
      grad.addColorStop(0, '#475569');
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(160, 160, 128, 0, Math.PI * 2);
      ctx.fill();

      if (faceLandmarker && video && isLoaded && isTalking) {
        try {
          const results = await faceLandmarker.detectForVideo(video, performance.now());
          
          if (results.faceLandmarks?.length > 0) {
            const landmarks = results.faceLandmarks[0];
            
            // Eyes with natural movement
            const leftEye = landmarks[33];
            const rightEye = landmarks[263];
            
            ctx.fillStyle = '#f8fafc';
            ctx.beginPath();
            ctx.ellipse(110 + (leftEye.x - 0.5) * 12, 125, 23, 26, -0.1, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(210 + (rightEye.x - 0.5) * 12, 125, 23, 26, 0.1, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#1e2937';
            ctx.beginPath();
            ctx.arc(110 + (leftEye.x - 0.5) * 8, 125, 11, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(210 + (rightEye.x - 0.5) * 8, 125, 11, 0, Math.PI * 2);
            ctx.fill();

            // MediaPipe-driven mouth (real lip sync)
            const upperLip = landmarks[13];
            const lowerLip = landmarks[14];
            const mouthHeight = Math.abs(upperLip.y - lowerLip.y) * 380;

            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 6.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(95, 195);
            ctx.quadraticCurveTo(160, 195 + Math.min(mouthHeight * 1.8, 42), 225, 195);
            ctx.stroke();
            
            return;
          }
        } catch (e) {}
      }

      // Fallback smooth animation when no camera
      const mouthPulse = isTalking ? Math.sin(frame / 2.5) * 11 + 18 : 8;
      
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(95, 195);
      ctx.quadraticCurveTo(160, 195 + mouthPulse, 225, 195);
      ctx.stroke();

      // Smart eyebrows
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 8.5;
      ctx.beginPath(); ctx.moveTo(72, 98); ctx.quadraticCurveTo(115, 83, 145, 97); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(175, 97); ctx.quadraticCurveTo(205, 83, 248, 98); ctx.stroke();

      frame++;
      animationFrame = requestAnimationFrame(animate);
    };

    animate();

    return () => cancelAnimationFrame(animationFrame);
  }, [isTalking, faceLandmarker, isLoaded]);

  return (
    <div className="relative w-[160px] h-[160px] mx-auto">
      <canvas 
        ref={canvasRef} 
        className="w-full h-full rounded-full border-4 border-zinc-700 shadow-xl"
      />
      <video ref={videoRef} className="hidden" />
      
      {error && (
        <div className="absolute inset-0 bg-black/70 rounded-full flex items-center justify-center text-[10px] text-amber-400">
          {error}
        </div>
      )}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full text-xs text-zinc-400">
          Loading Face Mesh...
        </div>
      )}
    </div>
  );
}