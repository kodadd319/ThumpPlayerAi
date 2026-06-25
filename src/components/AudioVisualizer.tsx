import React, { useEffect, useRef } from "react";
import { Zap, Volume2, Waves, Sliders } from "lucide-react";

interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  bassBoostLevel: number; // 0 to 100
  visualMode: "rta" | "subFlex" | "plasmaWave" | "dancingEq";
  setVisualMode: (mode: "rta" | "subFlex" | "plasmaWave" | "dancingEq") => void;
  isMaxBass: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  analyser,
  isPlaying,
  bassBoostLevel,
  visualMode,
  setVisualMode,
  isMaxBass,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  
  // Keep trace of peak fall positions for the RTA
  const peaksRef = useRef<number[]>([]);
  const peakDecaySpeed = 0.8;

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    
    // Fit to container dynamically using ResizeObserver
    const resizeObserver = new ResizeObserver(() => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth * window.devicePixelRatio;
        canvas.height = parent.clientHeight * window.devicePixelRatio;
        canvas.style.width = `${parent.clientWidth}px`;
        canvas.style.height = `${parent.clientHeight}px`;
      }
    });
    
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (analyser) {
      const bufferLength = analyser.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLength);
    }

    const render = () => {
      const W = canvas.width;
      const H = canvas.height;
      if (W === 0 || H === 0) {
        rafRef.current = requestAnimationFrame(render);
        return;
      }

      // Read audio data
      let maxFrequency = 0;
      let averageVolume = 0;
      let subBassForce = 0; // Average of first 6 bins (approx 30Hz - 90Hz)

      if (analyser && dataArrayRef.current && isPlaying) {
        if (visualMode === "plasmaWave") {
          analyser.getByteTimeDomainData(dataArrayRef.current);
        } else {
          analyser.getByteFrequencyData(dataArrayRef.current);
        }

        const dataArray = dataArrayRef.current;
        let sum = 0;
        let subSum = 0;
        const subBins = Math.min(6, dataArray.length);

        for (let i = 0; i < dataArray.length; i++) {
          const val = dataArray[i];
          sum += val;
          if (val > maxFrequency) maxFrequency = val;
          if (i < subBins) {
            subSum += val;
          }
        }
        averageVolume = sum / dataArray.length;
        subBassForce = subSum / subBins;
      }

      // Normalize values (0 to 1)
      const normalizedVol = averageVolume / 255;
      const normalizedSub = subBassForce / 255;
      const bassBoostFactor = (bassBoostLevel / 100) * 10 + (isMaxBass ? 1.5 : 0.0);
      const activeFlex = normalizedSub * (1.1 + bassBoostFactor * 0.9);

      // Clear with elegant slight opacity to leave glowing trails
      ctx.fillStyle = "rgba(10, 5, 4, 0.22)";
      ctx.fillRect(0, 0, W, H);

      // Draw standard glowing subtle grid background for elite cabin feel
      ctx.strokeStyle = "rgba(212, 175, 55, 0.05)";
      ctx.lineWidth = 1;
      const gridSize = 40 * window.devicePixelRatio;
      for (let x = 0; x < W; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y < H; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      const activeColor = isMaxBass 
        ? "rgb(153, 27, 27)" // Deep Cherry Burgundy
        : "rgb(212, 175, 55)"; // Champagne Gold

      if (visualMode === "rta") {
        // --- 1. RTA HEAD UNIT METER ---
        const totalBars = 32;
        const spacing = 4 * window.devicePixelRatio;
        const barWidth = (W - spacing * (totalBars + 1)) / totalBars;

        // Ensure peaks array is filled
        if (peaksRef.current.length !== totalBars) {
          peaksRef.current = new Array(totalBars).fill(0);
        }

        for (let i = 0; i < totalBars; i++) {
          // Read value from frequency data
          let rawVal = 0;
          if (dataArrayRef.current && isPlaying) {
            // Logarithmic index mapping looks more musically active
            const sampleIdx = Math.floor(Math.pow(i / totalBars, 1.3) * (dataArrayRef.current.length * 0.7));
            rawVal = dataArrayRef.current[sampleIdx] || 0;
          } else if (isPlaying) {
            // Idle simulated bounce
            rawVal = Math.sin(Date.now() * 0.003 + i * 0.3) * 40 + 60;
          }

          const percent = rawVal / 255;
          const barHeight = Math.max(8, percent * (H - 50));

          // Draw neon spectrum bar column
          const x = spacing + i * (barWidth + spacing);
          const y = H - barHeight - 15;

          // LED segment styling (draw segment stack)
          const totalLEDs = 14;
          const ledHeight = barHeight / totalLEDs;
          const ledGap = 1.5 * window.devicePixelRatio;

          for (let j = 0; j < totalLEDs; j++) {
            const ledY = H - 15 - (j * (ledHeight + ledGap));
            if (ledY < y) break;

            // Segment color scheme: custom amber gold, with warning mahogany red clip at top
            let color = "rgba(139, 92, 26, 0.95)"; // Brassy gold bottom
            if (j > totalLEDs * 0.85) {
              color = "rgba(153, 27, 27, 0.95)"; // Cherry burgundy clip
            } else if (j > totalLEDs * 0.6) {
              color = "rgba(255, 255, 255, 0.95)"; // Piano white highlight
            } else if (j > totalLEDs * 0.35) {
              color = "rgba(212, 175, 55, 0.95)"; // Shining Champagne Gold
            }

            ctx.fillStyle = color;
            ctx.shadowBlur = isMaxBass ? 12 : 2;
            ctx.shadowColor = color;
            ctx.fillRect(x, ledY - ledHeight, barWidth, ledHeight);
          }

          // Peak fall indicators
          if (barHeight > peaksRef.current[i]) {
            peaksRef.current[i] = barHeight;
          } else {
            peaksRef.current[i] = Math.max(0, peaksRef.current[i] - peakDecaySpeed * window.devicePixelRatio);
          }

          // Draw peak block (solid chrome white/silver)
          const peakY = H - 15 - peaksRef.current[i] - 3;
          ctx.fillStyle = "rgb(255, 255, 255)";
          ctx.shadowBlur = 10;
          ctx.shadowColor = "rgb(255, 255, 255)";
          ctx.fillRect(x, peakY - (2 * window.devicePixelRatio), barWidth, 3 * window.devicePixelRatio);
        }
        ctx.shadowBlur = 0; // reset shadow

      } else if (visualMode === "subFlex") {
        // --- 2. SUBWOOFER CONE FLEX SIMULATOR ---
        const centerX = W / 2;
        const centerY = H / 2;
        const maxRadius = Math.min(W, H) * 0.35;

        // Flex intensity shakes the simulated "box screws" and shadows
        const flexOffset = activeFlex * 35; 
        const flexScale = 1.0 + activeFlex * 0.12;

        // Apply visual distortion / screen vibration
        ctx.save();
        if (activeFlex > 0.4) {
          const shakeX = (Math.random() - 0.5) * activeFlex * 6;
          const shakeY = (Math.random() - 0.5) * activeFlex * 6;
          ctx.translate(shakeX, shakeY);
        }

        // Draw Subwoofer Outer Enclosure Ring - High Chrome Polish Bezel
        const chromeEncl = ctx.createLinearGradient(centerX - maxRadius, centerY - maxRadius, centerX + maxRadius, centerY + maxRadius);
        chromeEncl.addColorStop(0, "#ffffff");
        chromeEncl.addColorStop(0.2, "#cbd5e1");
        chromeEncl.addColorStop(0.4, "#475569");
        chromeEncl.addColorStop(0.5, "#f1f5f9");
        chromeEncl.addColorStop(0.6, "#1e293b");
        chromeEncl.addColorStop(0.8, "#94a3b8");
        chromeEncl.addColorStop(1, "#ffffff");

        ctx.strokeStyle = chromeEncl;
        ctx.lineWidth = 14 * window.devicePixelRatio;
        ctx.beginPath();
        ctx.arc(centerX, centerY, maxRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Outer LED Halo ring - Deep Amber gold or warning burgundy
        ctx.strokeStyle = activeColor;
        ctx.lineWidth = (2 + activeFlex * 7) * window.devicePixelRatio;
        ctx.shadowBlur = isMaxBass ? 25 : 12;
        ctx.shadowColor = activeColor;
        ctx.beginPath();
        ctx.arc(centerX, centerY, maxRadius + 12, 0, Math.PI * 2);
        ctx.stroke();

        // Reset blur for inside cone elements
        ctx.shadowBlur = 0;

        // Draw deep shiny mahogany red-black wood lacquer cone surround
        const surroundGradient = ctx.createRadialGradient(
          centerX, centerY, maxRadius * 0.5,
          centerX, centerY, maxRadius * 0.95
        );
        surroundGradient.addColorStop(0, "rgba(20, 10, 5, 1)");
        surroundGradient.addColorStop(0.5, "rgba(5, 2, 2, 1)");
        surroundGradient.addColorStop(0.85, "rgba(45, 15, 15, 1)"); // Deep polished mahogany red-black reflection
        surroundGradient.addColorStop(1, "#f3efe0"); // luxurious chrome/gold edge
        
        ctx.fillStyle = surroundGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, maxRadius, 0, Math.PI * 2);
        ctx.fill();

        // Draw Surround Rubber roll flexing (Deep Slate Black)
        ctx.strokeStyle = "rgba(15, 23, 42, 1)";
        ctx.lineWidth = (16 + activeFlex * 10) * window.devicePixelRatio; 
        ctx.beginPath();
        ctx.arc(centerX, centerY, maxRadius * 0.85, 0, Math.PI * 2);
        ctx.stroke();

        // Subwoofer Dustcap - Brushed Aluminum Chrome dome
        const coneRadius = maxRadius * 0.65 * flexScale;
        const coneGradient = ctx.createRadialGradient(
          centerX - coneRadius * 0.2, centerY - coneRadius * 0.2, 0,
          centerX, centerY, coneRadius
        );
        coneGradient.addColorStop(0, "#ffffff");
        coneGradient.addColorStop(0.25, "#e2e8f0");
        coneGradient.addColorStop(0.5, "#94a3b8");
        coneGradient.addColorStop(0.75, "#334155");
        coneGradient.addColorStop(0.9, "#0f172a");
        coneGradient.addColorStop(1, "#cbd5e1");

        ctx.fillStyle = coneGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, coneRadius, 0, Math.PI * 2);
        ctx.fill();

        // Inner cobalt blue ring detailing on dustcap
        ctx.strokeStyle = activeColor;
        ctx.lineWidth = 3 * window.devicePixelRatio;
        ctx.beginPath();
        ctx.arc(centerX, centerY, coneRadius * 0.6, 0, Math.PI * 2);
        ctx.stroke();

        // Subwoofer Brand logo stamp (glowing steel lines matching bass level)
        ctx.font = `600 ${Math.round(18 * flexScale * window.devicePixelRatio)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgb(28, 15, 12)";
        ctx.fillText("ELITE_900", centerX, centerY);

        // Draw expanding gold acoustic compression pressure waves
        if (activeFlex > 0.4) {
          ctx.strokeStyle = `rgba(${isMaxBass ? "153, 27, 27" : "212, 175, 55"}, ${activeFlex * 0.75})`;
          ctx.lineWidth = 4 * window.devicePixelRatio;
          const waveRadius = maxRadius + flexOffset * 1.5;
          ctx.beginPath();
          ctx.arc(centerX, centerY, waveRadius, 0, Math.PI * 2);
          ctx.stroke();

          // Second wider wave
          if (activeFlex > 0.6) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, waveRadius * 1.3, 0, Math.PI * 2);
            ctx.stroke();
          }
        }

        ctx.restore();

      } else if (visualMode === "plasmaWave") {
        // --- 3. NEON WAVE / OSCILLOSCOPE ---
        ctx.shadowBlur = 15;
        ctx.shadowColor = activeColor;

        ctx.strokeStyle = activeColor;
        ctx.lineWidth = (3 + normalizedVol * 6) * window.devicePixelRatio;
        ctx.beginPath();

        const points = 50;
        const sliceWidth = W / points;

        for (let i = 0; i <= points; i++) {
          const x = i * sliceWidth;
          
          // Compute Y offset
          let waveOffset = 0.5;
          if (dataArrayRef.current && isPlaying) {
            const sampleIdx = Math.floor((i / points) * dataArrayRef.current.length);
            // Convert byte data to amplitude (-1 to 1)
            waveOffset = dataArrayRef.current[sampleIdx] / 255.0;
          } else if (isPlaying) {
            // Simulated idle sine
            waveOffset = 0.5 + Math.sin(Date.now() * 0.005 + i * 0.3) * 0.15;
          }

          const amplitude = H * 0.35 * (1 + activeFlex * 0.5);
          const y = (H / 2) + (waveOffset - 0.5) * amplitude;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();

        // Draw a overlapping complementary silver wave
        const altColor = "rgba(226, 232, 240, 0.75)";
        ctx.strokeStyle = altColor;
        ctx.shadowColor = altColor;
        ctx.lineWidth = (1.5 + normalizedVol * 3) * window.devicePixelRatio;
        ctx.beginPath();

        for (let i = 0; i <= points; i++) {
          const x = i * sliceWidth;
          
          let waveOffset = 0.5;
          if (dataArrayRef.current && isPlaying) {
            // Read index slightly offset
            const sampleIdx = Math.floor((1 - (i / points)) * dataArrayRef.current.length);
            waveOffset = dataArrayRef.current[sampleIdx] / 255.0;
          } else if (isPlaying) {
            waveOffset = 0.5 + Math.cos(Date.now() * 0.004 + i * 0.2) * 0.1;
          }

          const amplitude = H * 0.28 * (1 + activeFlex * 0.45);
          const y = (H / 2) + (waveOffset - 0.5) * amplitude;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();

        ctx.shadowBlur = 0; // reset
      } else if (visualMode === "dancingEq") {
        // --- 4. COLOR DANCING EQUALIZER ---
        const totalBars = 24;
        const spacing = 4 * window.devicePixelRatio;
        const barWidth = (W - spacing * (totalBars + 1)) / totalBars;

        // Ensure peaks array is filled
        if (peaksRef.current.length !== totalBars) {
          peaksRef.current = new Array(totalBars).fill(0);
        }

        for (let i = 0; i < totalBars; i++) {
          let rawVal = 0;
          if (dataArrayRef.current && isPlaying) {
            // Logarithmic mapping of frequency indices
            const index = Math.min(
              dataArrayRef.current.length - 1,
              Math.floor(Math.pow(i / totalBars, 1.22) * (dataArrayRef.current.length * 0.55))
            );
            rawVal = dataArrayRef.current[index] || 0;
          } else if (isPlaying) {
            // Standby play bounce
            rawVal = Math.sin(Date.now() * 0.0035 + i * 0.4) * 45 + 75 + Math.random() * 15;
          } else {
            // Idle ripple
            rawVal = Math.sin(Date.now() * 0.001 + i * 0.2) * 5 + 10;
          }

          const percent = rawVal / 255;
          const barHeight = Math.max(6 * window.devicePixelRatio, percent * (H - 55));

          const x = spacing + i * (barWidth + spacing);
          
          // Draw segmented LED columns
          const ledBlockCount = 16;
          const ledHeight = barHeight / ledBlockCount;
          const ledGap = 1.5 * window.devicePixelRatio;

          for (let j = 0; j < ledBlockCount; j++) {
            const ledY = H - 15 - (j * (ledHeight + ledGap));
            const currentPercent = j / ledBlockCount;
            if (j * (ledHeight + ledGap) > barHeight) break;

            // Gradient: Soft wood tones -> Gold -> Warm red peaks
            let color = "rgba(197, 168, 128, 0.95)"; // Brushed soft gold
            if (currentPercent > 0.85) {
              color = "rgba(153, 27, 27, 0.95)"; // Mahogany peak clip
            } else if (currentPercent > 0.65) {
              color = "rgba(212, 175, 55, 0.95)"; // Champagne gold
            } else if (currentPercent > 0.4) {
              color = "rgba(245, 224, 195, 0.95)"; // Saddle beige leather tone
            }

            ctx.fillStyle = color;
            if (isMaxBass) {
              ctx.shadowBlur = 6;
              ctx.shadowColor = color;
            }
            ctx.fillRect(x, ledY - ledHeight, barWidth, ledHeight);
          }

          // Peak holding physics
          if (barHeight > peaksRef.current[i]) {
            peaksRef.current[i] = barHeight;
          } else {
            peaksRef.current[i] = Math.max(0, peaksRef.current[i] - 1.2 * window.devicePixelRatio);
          }

          // Draw peak block
          const peakY = H - 15 - peaksRef.current[i] - 2;
          ctx.fillStyle = "rgba(255, 255, 255, 1)";
          ctx.shadowBlur = 8;
          ctx.shadowColor = "rgba(255, 255, 255, 0.8)";
          ctx.fillRect(x, peakY - (1.5 * window.devicePixelRatio), barWidth, 3 * window.devicePixelRatio);
        }
        ctx.shadowBlur = 0;
      }

      // Draw standard top digital HUD overlay
      ctx.fillStyle = "rgba(12, 7, 5, 0.95)";
      ctx.fillRect(8 * window.devicePixelRatio, 8 * window.devicePixelRatio, 130 * window.devicePixelRatio, 24 * window.devicePixelRatio);
      ctx.strokeStyle = "rgba(212, 175, 55, 0.45)";
      ctx.lineWidth = 1;
      ctx.strokeRect(8 * window.devicePixelRatio, 8 * window.devicePixelRatio, 130 * window.devicePixelRatio, 24 * window.devicePixelRatio);

      ctx.fillStyle = "rgb(255, 255, 255)";
      ctx.font = `600 ${Math.round(10 * window.devicePixelRatio)}px sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const dbLabel = isPlaying ? `CABIN_GAIN: ${Math.round(normalizedVol * 100)}%` : "CABIN_GAIN: STDBY";
      ctx.fillText(dbLabel, 14 * window.devicePixelRatio, 20 * window.devicePixelRatio);

      rafRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [analyser, isPlaying, visualMode, bassBoostLevel, isMaxBass]);

  return (
    <div id="visualizer-stage" className="relative w-full h-full bg-[#0a0504]/50 rounded-2xl overflow-hidden shadow-2xl flex flex-col justify-end border border-stone-850">
      {/* Visual Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-0 block pointer-events-none" />

      {/* Visualizer Mode selector overlay */}
      <div className="absolute right-3 top-3 z-10 flex gap-2">
        <button
          id="mode-btn-rta"
          onClick={() => setVisualMode("rta")}
          className={`p-2 rounded-lg transition-all flex items-center gap-1.5 border-2 text-xs font-sans font-semibold ${
            visualMode === "rta"
              ? "bg-white text-[#1c0303] border-slate-350 shadow-white/[0.25] shadow-lg"
              : "bg-black/95 text-slate-350 border-slate-800/40 hover:text-white hover:border-slate-500"
          }`}
          title="RTA Head-unit Meter"
        >
          <Zap className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">RTA ANALYZER</span>
        </button>

        <button
          id="mode-btn-subflex"
          onClick={() => setVisualMode("subFlex")}
          className={`p-2 rounded-lg transition-all flex items-center gap-1.5 border-2 text-xs font-sans font-semibold ${
            visualMode === "subFlex"
              ? "bg-white text-[#1c0303] border-slate-350 shadow-white/[0.25] shadow-lg"
              : "bg-black/95 text-slate-350 border-slate-800/40 hover:text-white hover:border-slate-500"
          }`}
          title="Subwoofer Flex Simulator"
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">CONE FLEX</span>
        </button>

        <button
          id="mode-btn-wave"
          onClick={() => setVisualMode("plasmaWave")}
          className={`p-2 rounded-lg transition-all flex items-center gap-1.5 border-2 text-xs font-sans font-semibold ${
            visualMode === "plasmaWave"
              ? "bg-white text-[#1c0303] border-slate-350 shadow-white/[0.25] shadow-lg"
              : "bg-black/95 text-slate-350 border-slate-800/40 hover:text-white hover:border-slate-500"
          }`}
          title="Neon Wave Oscilloscope"
        >
          <Waves className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">WAVE SCOPE</span>
        </button>

        <button
          id="mode-btn-dancingeq"
          onClick={() => setVisualMode("dancingEq")}
          className={`p-2 rounded-lg transition-all flex items-center gap-1.5 border-2 text-xs font-sans font-semibold ${
            visualMode === "dancingEq"
              ? "bg-white text-[#1c0303] border-slate-350 shadow-white/[0.25] shadow-lg"
              : "bg-black/95 text-slate-350 border-slate-800/40 hover:text-white hover:border-slate-500"
          }`}
          title="Color Dancing Equalizer"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">DANCING EQ</span>
        </button>
      </div>

      {/* Floating alert indicators */}
      {isMaxBass && isPlaying && (
        <div className="absolute left-4 top-14 bg-[#4a1515]/95 text-red-100 font-sans text-[10px] font-semibold px-2 py-0.5 rounded border border-[#991b1b] animate-pulse z-10 tracking-widest uppercase flex items-center gap-1 shadow-lg shadow-[#991b1b]/35">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
          CABIN RESONANCE DETECTED // ACTIVE COMPENSATION SHIELDING ENGAGED
        </div>
      )}
    </div>
  );
};
