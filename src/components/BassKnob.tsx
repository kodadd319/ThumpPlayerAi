import React, { useRef, useState } from "react";

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

  // Degrees of rotation: from -135deg (min) to +135deg (max)
  const percent = (value - min) / (max - min);
  const rotationDegrees = -135 + percent * 270;

  // Converts click/move client coordinates into the dial's corresponding percentage (0-100)
  const getAngleAndValue = (clientX: number, clientY: number, dragging = false): number => {
    if (!knobRef.current) return value;
    const rect = knobRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // DX and DY relative to the center of the knob
    const dx = clientX - centerX;
    const dy = clientY - centerY;

    // Angle relative to 12 o'clock (straight up) which maps naturally to a -180 to 180 range
    let angleDeg = Math.atan2(dx, -dy) * (180 / Math.PI);

    // Active zone is -135deg to +135deg. Inside the dead zone (underneath), 
    // we use a physical barrier using the current value to prevent instantaneous jump-crossing.
    const isDeadZone = angleDeg < -135 || angleDeg > 135;

    if (isDeadZone) {
      if (value > (min + max) / 2) {
        return max;
      } else {
        return min;
      }
    }

    // Map the -135 to +135 degree range onto min to max
    const pct = (angleDeg + 135) / 270;
    let computedVal = min + pct * (max - min);
    computedVal = Math.max(min, Math.min(max, computedVal));
    const nextVal = Math.round(computedVal);

    // Barrier stop check: If dragging, prevent huge instantaneous jumps across the bottom boundary.
    if (dragging) {
      const diff = Math.abs(nextVal - value);
      if (diff > (max - min) * 0.5) {
        return value;
      }
    }

    return nextVal;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    setIsDragging(true);
    knobRef.current?.setPointerCapture(e.pointerId);

    // Calculate rotation angle immediately and turn dial
    const nextVal = getAngleAndValue(e.clientX, e.clientY, false);
    onChange(nextVal);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const nextVal = getAngleAndValue(e.clientX, e.clientY, true);
    onChange(nextVal);
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
        className="relative flex items-center justify-center p-5 rounded-full border-2 border-blue-500/50 bg-[#091122] shadow-[0_0_20px_rgba(58,219,255,0.45),inset_0_2px_10px_rgba(58,219,255,0.15)]"
        style={{ width: "190px", height: "190px" }}
      >
        {/* Glow behind active dial */}
        <div 
          className="absolute inset-4 rounded-full blur-2xl opacity-60 transition-all duration-300 pointer-events-none animate-pulse"
          style={{
            backgroundColor: percent === 1 ? "rgba(58, 219, 255, 0.85)" : "rgba(58, 219, 255, 0.55)",
            boxShadow: percent === 1 
              ? "0 0 45px rgba(58, 219, 255, 0.95)" 
              : "0 0 30px rgba(58, 219, 255, 0.75)"
          }}
        />

        {/* Surrounding illuminated Bass LED collar path */}
        <div
          className="absolute rounded-full border border-sky-400/40 pointer-events-none animate-pulse"
          style={{
            width: "150px",
            height: "150px",
            boxShadow: percent === 1
              ? "0 0 25px rgba(58, 219, 255, 0.95)"
              : "0 0 15px rgba(58, 219, 255, 0.75)"
          }}
        />

        {/* LED progress ticks circular ring */}
        <svg className="absolute inset-0 w-full h-full transform -rotate-90 pointer-events-none" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="43"
            fill="none"
            stroke="#101726"
            strokeWidth="3.5"
          />
          <circle
            id="active-knob-dial-progress"
            cx="50"
            cy="50"
            r="43"
            fill="none"
            stroke="#3adbff"
            strokeWidth="4"
            strokeDasharray={percent > 0 ? `${percent * (2 * Math.PI * 43)} 999` : "0 999"}
            strokeLinecap="round"
            className={`transition-all duration-75 ${
              percent === 1 
                ? "drop-shadow-[0_0_15px_rgba(58,219,255,0.95)]" 
                : "drop-shadow-[0_0_6px_rgba(58,219,255,0.7)]"
            }`}
          />
        </svg>

        {/* Solid Shiny Chrome Rotary Dial Wheel: Enlarged (w-36 h-36) */}
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
            disabled ? "opacity-40 cursor-not-allowed" : "focus:ring-2 focus:ring-sky-300 hover:scale-[1.03] hover:shadow-[0_0_28px_rgba(58,219,255,0.55)]"
          }`}
          style={{ 
            touchAction: "none",
            background: "linear-gradient(135deg, #f8fafc 0%, #cbd5e1 15%, #94a3b8 35%, #475569 50%, #1e293b 65%, #94a3b8 80%, #f8fafc 100%)",
            boxShadow: "0 10px 20px rgba(0,0,0,0.85), inset 0 2px 4px rgba(255,255,255,0.85), inset 0 -4px 12px rgba(0,0,0,0.65)"
          }}
        >
          {/* Beveled Polished Chrome Ring */}
          <div className="absolute inset-1.5 rounded-full pointer-events-none bg-gradient-to-tr from-[#94a3b8] via-white via-[#e2e8f0] to-[#334155] opacity-90 border border-white/45 shadow-inner" />
          
          {/* Inner Circular Cap Face with Radial Brushed Reflection */}
          <div 
            className="absolute inset-[13px] rounded-full pointer-events-none transition-transform duration-75"
            style={{
              transform: `rotate(${rotationDegrees}deg)`,
              background: "radial-gradient(circle, #f1f5f9 0%, #cbd5e1 35%, #475569 75%, #19253c 100%)",
              boxShadow: "inset 0 3px 6px rgba(255,255,255,0.5), inset 0 -3px 6px rgba(0,0,0,0.5)"
            }}
          >
            {/* Fine Concentric Lathe Sound-grooves */}
            <div className="absolute inset-1.5 rounded-full border border-white/10" />
            <div className="absolute inset-3.5 rounded-full border border-white/5" />
            <div className="absolute inset-5.5 rounded-full border border-black/15" />
            
            {/* Center shiny metal bezel */}
            <div className="absolute inset-[24px] rounded-full bg-gradient-to-tr from-[#475569] via-white to-[#cbd5e1] opacity-75 shadow-md" />
            <div className="absolute inset-[27px] rounded-full bg-[#0b0f19] opacity-90" />
 
             {/* Glowing High-end Dial Indicator Line */}
            <div
              className="absolute top-1.5 bottom-1/2 left-1/2 -ml-[1px] w-1 rounded bg-sky-400 shadow-md origin-bottom pointer-events-none transition-colors"
              style={{
                backgroundColor: "#3adbff",
                boxShadow: percent === 1 
                  ? "0 0 15px #3adbff, 0 0 4px #ffffff" 
                  : "0 0 8px #3adbff, 0 0 2px #ffffff"
              }}
            />

            {/* Tactile Jewel Indicator Dot for setting position of the knob */}
            <div 
              className="absolute w-3.5 h-3.5 rounded-full border-2 border-slate-900 shadow-lg transition-colors"
              style={{
                top: "12px",
                left: "calc(50% - 7px)",
                backgroundColor: "#38bdf8",
                boxShadow: percent === 1 
                  ? "0 0 12px #3adbff, inset 0 1px 2px #fff" 
                  : "0 0 8px #3adbff, inset 0 1px 2px #fff"
              }}
            />
          </div>
        </div>
      </div>

      {/* Numerical Value read-out */}
      <div className="mt-4 text-center">
        <span className="text-[10px] uppercase tracking-widest font-mono text-slate-400 block font-black">Bass Level</span>
        <span 
          className="text-xl font-black font-mono transition-all duration-150 text-[#3adbff]"
          style={{
            textShadow: percent === 1 
              ? "0 0 15px rgba(58, 219, 255, 0.95), 0 0 4px rgba(58, 219, 255, 0.45)" 
              : "0 0 6px rgba(58, 219, 255, 0.5)"
          }}
        >
          {value}%
        </span>
      </div>
    </div>
  );
};
