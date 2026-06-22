import React from "react";
import { Sliders, RotateCcw, Lock } from "lucide-react";
import { Preset } from "../types";

interface EqSlidersProps {
  gains: number[]; // 5 values: 60Hz, 250Hz, 1kHz, 4kHz, 16kHz
  onChange: (index: number, val: number) => void;
  onReset: () => void;
  presets: Preset[];
  selectedPresetName: string;
  onPresetSelect: (preset: Preset) => void;
  isPremiumActive?: boolean;
}

export const EqSliders: React.FC<EqSlidersProps> = ({
  gains,
  onChange,
  onReset,
  presets,
  selectedPresetName,
  onPresetSelect,
  isPremiumActive = false
}) => {
  const bands = [
    { label: "60 Hz", subtext: "Sub-Bass", color: "from-[#0a4bf0] to-blue-900" },
    { label: "250 Hz", subtext: "Mid-Bass", color: "from-[#053cf2] to-blue-800" },
    { label: "1 kHz", subtext: "Vocal Mid", color: "from-[#1052f5] to-blue-900" },
    { label: "4 kHz", subtext: "Upper Mid", color: "from-[#1c64f7] to-indigo-900" },
    { label: "16 kHz", subtext: "High Treble", color: "from-[#2b7cf8] to-slate-900" }
  ];

  return (
    <div className="bg-slate-950/20 p-4 rounded-xl flex flex-col h-full relative">
      {/* EQ Header */}
      <div className="flex items-center justify-between mb-4 z-10">
        <div className="flex items-center gap-2">
          <Sliders className="w-5 h-5 text-blue-500" />
          <h3 className="font-mono text-xs font-black uppercase tracking-widest text-[#cbd5e1] chrome-text">
            Presets
          </h3>
        </div>
        <button
          id="reset-eq-btn"
          onClick={onReset}
          className="text-[10px] font-mono font-bold text-slate-200 hover:text-white transition-colors bg-gradient-to-b from-slate-800 to-slate-950 px-2.5 py-1.5 rounded border border-slate-500 flex items-center gap-1 active:bg-black shadow cursor-pointer font-black"
          title="Reset EQ to flat 0dB"
        >
          <RotateCcw className="w-3 h-3 text-blue-400" />
          FLAT
        </button>
      </div>

      {/* Preset Select Buttons */}
      <div className="flex flex-col gap-1.5 mb-4 z-10 border-b border-slate-800/80 pb-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-1.5">
          {presets.map((preset) => {
            const isSelected = selectedPresetName === preset.name;
            const isLocked = preset.isPremium && !isPremiumActive;
            return (
              <button
                key={preset.name}
                type="button"
                onClick={() => onPresetSelect(preset)}
                className={`px-2.5 py-1.5 rounded-lg border-2 text-[10px] font-mono font-black tracking-wider transition-all cursor-pointer text-left uppercase truncate flex items-center justify-between gap-1 ${
                  isSelected
                    ? "bg-[#052cf0]/30 text-white border-white shadow-[0_0_8px_rgba(5,44,240,0.5)]"
                    : "bg-black border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-white"
                }`}
                title={preset.name}
              >
                <span className="truncate">{preset.name}</span>
                {isLocked && <Lock className="w-2.5 h-2.5 text-amber-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of Equalizer faders */}
      <div className="flex-1 grid grid-cols-5 gap-3.5 items-stretch relative min-h-[160px] md:min-h-[200px] z-10">
        
        {/* Horizontal dB alignment indicator lines in background */}
        <div className="absolute inset-x-0 top-[8%] bottom-[8%] flex flex-col justify-between pointer-events-none opacity-20">
          <div className="border-t border-dashed border-slate-600 text-[8px] font-mono text-slate-400 pl-1 pt-0.5">+12dB</div>
          <div className="border-t border-dashed border-slate-600 text-[8px] font-mono text-slate-400 pl-1 pt-0.5">+6dB</div>
          <div className="border-t border-solid border-slate-700 text-[8px] font-mono text-blue-500 pl-1 pt-0.5">0dB (FLAT)</div>
          <div className="border-t border-dashed border-slate-600 text-[8px] font-mono text-slate-400 pl-1 pt-0.5">-6dB</div>
          <div className="border-t border-dashed border-slate-600 text-[8px] font-mono text-slate-400 pl-1 pt-0.5">-12dB</div>
        </div>

        {bands.map((band, idx) => {
          const currentGain = gains[idx] ?? 0;
          // Calculate slider percentage (from -12 to 12)
          const percent = ((currentGain + 12) / 24) * 100;

          return (
            <div key={idx} className="flex flex-col items-center justify-between z-10 relative group">
              {/* dB indicator label directly above fader */}
              <span className={`text-[11px] font-mono font-bold ${
                currentGain > 6 ? "text-red-400" : currentGain < -6 ? "text-slate-400" : "text-blue-400"
              }`}>
                {currentGain > 0 ? `+${currentGain.toFixed(0)}` : currentGain.toFixed(0)}
              </span>

              {/* Slider Track Body Column */}
              <div className="relative w-7 flex-1 my-3 flex items-center justify-center">
                {/* Visual track background groove */}
                <div className="absolute inset-y-0 w-2.5 rounded-full bg-slate-950 border border-slate-750 shadow-inner" />
                
                {/* Active range fill indicator */}
                <div 
                  className={`absolute bottom-0 w-1.5 rounded-full bg-gradient-to-t ${band.color} opacity-60 shadow-[0_0_8px_rgba(10,75,240,0.5)]`}
                  style={{ height: `${percent}%` }}
                />

                {/* Range Input element */}
                <input
                  id={`eq-fader-${idx}`}
                  type="range"
                  min="-12"
                  max="12"
                  step="1"
                  value={currentGain}
                  onChange={(e) => onChange(idx, parseInt(e.target.value))}
                  className="absolute cursor-ns-resize w-full h-full opacity-0 pointer-events-auto"
                  style={{
                    writingMode: "bt-lr", // vertical fader support
                    WebkitAppearance: "slider-vertical",
                  }}
                  aria-label={`${band.label} gain fader`}
                />
                
                {/* Custom Neon Knurled Slider Fader Knob */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 w-6 h-3.5 rounded bg-gradient-to-b from-[#ffffff] via-[#f1f5f9] via-[#94a3b8] via-[#09101d] via-[#cbd5e1] to-[#ffffff] border-2 border-slate-300 shadow-xl pointer-events-none cursor-ns-resize flex flex-col justify-between p-0.5 transition-all"
                  style={{
                    bottom: `calc(${percent}% - 7px)`,
                    boxShadow: "0 3px 6px rgba(0,0,0,0.9), inset 0 1px 1.5px rgba(255,255,255,0.95)"
                  }}
                >
                  {/* Grip teeth center lines */}
                  <div className="w-full h-[1px] bg-white/20" />
                  <div className="w-full h-1 bg-[#094bf0] rounded-sm shadow-[0_0_8px_#094bf0,0_0_2px_#fff]" />
                  <div className="w-full h-[1px] bg-black/40" />
                </div>
              </div>

              {/* Fader Labels */}
              <div className="text-center">
                <span className="text-[10px] font-extrabold font-mono text-slate-100 block tracking-tight truncate max-w-[50px] md:max-w-none">
                  {band.label}
                </span>
                <span className="text-[8px] font-mono text-slate-500 block leading-none">
                  {band.subtext}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
