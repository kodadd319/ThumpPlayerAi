import React, { useRef, useState, useEffect } from "react";

interface BassKnobProps {
  value: number; // 0 to 100
  min?: number;
  max?: number;
  onChange: (val: number) => void;
  disabled?: boolean;
}

export const BassKnob: React.FC<BassKnobProps> = ({
  value,
  min = 0,
  max = 100,
  onChange,
  disabled = false,
}) => {
  const knobRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const valueRef = useRef<number>(value);
  const centerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Synchronize internal valueRef when state changes from parent
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // Degrees of rotation: from -135deg (min) to +135deg (max)
  const percent = (value - min) / (max - min);
  const rotationDegrees = -135 + percent * 270;

  const updateValueFromCoords = (clientX: number, clientY: number) => {
    const { x: centerX, y: centerY } = centerRef.current;
    const dx = clientX - centerX;
    const dy = clientY - centerY;

    const radius = Math.sqrt(dx * dx + dy * dy);
    // Ignore moves extremely close to center to avoid noisy angular jumps
    if (radius < 8) return;

    // Angle relative to straight up (0 deg is top, positive is right/clockwise, negative is left/counter-clockwise)
    let angle = Math.atan2(dx, -dy) * (180 / Math.PI); // -180 to 180

    let targetPercent = 0;
    if (angle >= -135 && angle <= 135) {
      targetPercent = (angle + 135) / 270;
    } else {
      // In the bottom dead-zone (absolute angle > 135)
      // We clamp to 100% (1) or 0% (0) based on which side the previous value was closer to
      if (valueRef.current > (min + max) / 2) {
        targetPercent = 1;
      } else {
        targetPercent = 0;
      }
    }

    const nextVal = min + targetPercent * (max - min);
    valueRef.current = nextVal;
    onChange(Math.round(nextVal));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    setIsDragging(true);
    knobRef.current?.setPointerCapture(e.pointerId);

    if (!knobRef.current) return;
    const rect = knobRef.current.getBoundingClientRect();
    centerRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };

    updateValueFromCoords(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || disabled) return;
    updateValueFromCoords(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    knobRef.current?.releasePointerCapture(e.pointerId);
  };

  // Keyboard navigation support
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const step = 1; // Precise 1% increments on arrows
    if (e.key === "ArrowUp" || e.key === "ArrowRight") {
      onChange(Math.min(max, value + step));
    } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
      onChange(Math.max(min, value - step));
    }
  };

  return (
    <div className="flex flex-col items-center select-none">
      {/* Outer Dial Panel */}
      <div
        id="bass-knob-container"
        className="relative flex items-center justify-center p-5 rounded-full border-2 border-slate-750 bg-[#0e0807] shadow-[0_12px_35px_rgba(0,0,0,0.9),inset_0_2px_12px_rgba(255,255,255,0.08)]"
        style={{ width: "190px", height: "190px" }}
      >
        {/* Glow behind active dial */}
        <div 
          className="absolute inset-4 rounded-full blur-2xl opacity-60 transition-all duration-300 pointer-events-none animate-pulse"
          style={{
            backgroundColor: percent === 1 ? "rgba(255, 255, 255, 0.75)" : "rgba(255, 255, 255, 0.35)",
            boxShadow: percent === 1 
              ? "0 0 45px rgba(255, 255, 255, 0.85)" 
              : "0 0 30px rgba(255, 255, 255, 0.45)"
          }}
        />

        {/* Surrounding illuminated Bass LED collar path */}
        <div
          className="absolute rounded-full border border-white/20 pointer-events-none animate-pulse"
          style={{
            width: "150px",
            height: "150px",
            boxShadow: percent === 1
              ? "0 0 25px rgba(255, 255, 255, 0.85)"
              : "0 0 15px rgba(255, 255, 255, 0.45)"
          }}
        />

        {/* LED progress ticks circular ring */}
        <svg className="absolute inset-0 w-full h-full transform pointer-events-none" viewBox="0 0 100 100">
          {/* Faint white background track covering the 270-degree range */}
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="3"
            strokeDasharray={`${2 * Math.PI * 42 * 0.75} ${2 * Math.PI * 42}`}
            strokeLinecap="round"
            transform="rotate(135 50 50)"
          />
          {/* Active level status ring with vibrant white neon glow */}
          <circle
            id="active-knob-dial-progress"
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="#ffffff"
            strokeWidth="4"
            strokeDasharray={`${percent * (2 * Math.PI * 42 * 0.75)} ${2 * Math.PI * 42}`}
            strokeLinecap="round"
            transform="rotate(135 50 50)"
            className="transition-all duration-75"
            style={{
              filter: percent > 0 
                ? "drop-shadow(0 0 5px rgba(255, 255, 255, 0.95)) drop-shadow(0 0 10px rgba(255, 255, 255, 0.5))"
                : "none"
            }}
          />
        </svg>

        {/* Solid Brushed Chrome Cylindrical Rotary Dial Wheel */}
        <div
          ref={knobRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onKeyDown={handleKeyDown}
          tabIndex={disabled ? -1 : 0}
          role="slider"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-label="Bass Booster Control Knob"
          className={`relative w-36 h-36 rounded-full flex items-center justify-center cursor-pointer focus:outline-none transition-all duration-150 ${
            disabled ? "opacity-40 cursor-not-allowed" : "focus:ring-2 focus:ring-white/40 hover:scale-[1.02]"
          }`}
          style={{ 
            touchAction: "none",
            // The outer part creates a heavy cylindrical side/edge profile (the dark/light beveled chrome sides of the knob)
            background: "linear-gradient(135deg, #f1f5f9 0%, #cbd5e1 20%, #94a3b8 40%, #475569 60%, #1e293b 80%, #cbd5e1 100%)",
            boxShadow: `
              0 12px 24px rgba(0, 0, 0, 0.7),
              inset 0 2px 3px rgba(255, 255, 255, 0.95),
              inset 0 -6px 12px rgba(0, 0, 0, 0.85)
            `
          }}
        >
          {/* Beveled Polished Chrome Edge of the Cylinder */}
          <div className="absolute inset-[2px] rounded-full pointer-events-none bg-gradient-to-tr from-[#94a3b8] via-[#f1f5f9] to-[#334155] border border-white/50 shadow-[inset_0_2px_4px_rgba(255,255,255,0.8),0_4px_8px_rgba(0,0,0,0.5)]" />
          
          {/* Main Dial Face: Realistic Radial Brushed Chrome/Aluminum using a fine Conic Gradient */}
          <div 
            className="absolute inset-[6px] rounded-full pointer-events-none transition-transform duration-75"
            style={{
              transform: `rotate(${rotationDegrees}deg)`,
              // Conic gradient produces the anisotropic pie-slice metallic reflections seen in the photo
              background: "conic-gradient(from 0deg, #f8fafc, #cbd5e1 30deg, #e2e8f0 60deg, #64748b 110deg, #94a3b8 140deg, #f8fafc 180deg, #cbd5e1 210deg, #e2e8f0 240deg, #475569 290deg, #94a3b8 320deg, #f8fafc 360deg)",
              boxShadow: `
                inset 0 3px 5px rgba(255, 255, 255, 0.9),
                inset 0 -3px 8px rgba(0, 0, 0, 0.6),
                0 4px 8px rgba(0, 0, 0, 0.4)
              `
            }}
          >
            {/* Fine microscopic lathe lines inside the dial face for a high-end satin look */}
            <div className="absolute inset-[4px] rounded-full border border-white/10" />
            <div className="absolute inset-[10px] rounded-full border border-white/5" />
            <div className="absolute inset-[16px] rounded-full border border-black/15" />
            <div className="absolute inset-[22px] rounded-full border border-black/10" />

            {/* Glowing Backlit Selector Dot (Indented / Milled and LED illuminated) */}
            <div 
              className="absolute w-5 h-5 rounded-full transition-all duration-150 flex items-center justify-center"
              style={{
                top: "10px",
                left: "calc(50% - 10px)",
                // The outer ring of the indicator matches the physical metallic indentation profile
                background: "linear-gradient(135deg, #1e293b 0%, #cbd5e1 100%)",
                boxShadow: percent === 1
                  ? "0 0 16px 6px rgba(255, 255, 255, 0.95), 0 0 32px 12px rgba(255, 255, 255, 0.6), inset 0 2px 3px rgba(0,0,0,0.8)"
                  : "0 0 10px 3px rgba(255, 255, 255, 0.8), 0 0 20px 6px rgba(255, 255, 255, 0.45), inset 0 2px 3px rgba(0,0,0,0.8)"
              }}
            >
              {/* Inner glowing white LED core shining through the metal indent */}
              <div 
                className="w-2 h-2 rounded-full shadow-[0_0_6px_#fff]" 
                style={{
                  background: "radial-gradient(circle, #ffffff 40%, #e2e8f0 100%)",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Numerical Value read-out */}
      <div className="mt-4 text-center">
        <span className="text-[10px] uppercase tracking-widest font-sans text-slate-400 block font-semibold">Bass Level</span>
        <span 
          className="text-xl font-semibold font-sans transition-all duration-150 text-white"
          style={{
            textShadow: percent === 1 
              ? "0 0 15px rgba(255,255,255,0.9), 0 0 4px rgba(255,255,255,0.4)" 
              : "0 0 6px rgba(255,255,255,0.5)"
          }}
        >
          {value}%
        </span>
      </div>
    </div>
  );
};
