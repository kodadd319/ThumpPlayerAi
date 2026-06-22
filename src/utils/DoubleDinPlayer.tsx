import React, { useRef, useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Square,
  Shuffle,
  Volume2,
  VolumeX,
  Disc,
  Info,
  Radio,
  Sliders,
  Sparkles
} from "lucide-react";
import { Track } from "../types";

interface DoubleDinPlayerProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  songProgress: number;
  songDuration: number;
  volume: number; // 0.0 to 1.0
  shuffleMode: boolean;
  onPlayPause: () => void;
  onStop: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleShuffle: () => void;
  headunitTime: string;
  isMaxBass: boolean;
  onToggleMaxBass: () => void;
}

export function DoubleDinPlayer({
  currentTrack,
  isPlaying,
  songProgress,
  songDuration,
  volume,
  shuffleMode,
  onPlayPause,
  onStop,
  onPrev,
  onNext,
  onSeek,
  onVolumeChange,
  onToggleShuffle,
  headunitTime,
  isMaxBass,
  onToggleMaxBass
}: DoubleDinPlayerProps) {
  const knobRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef(volume);
  const onVolumeChangeRef = useRef(onVolumeChange);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    onVolumeChangeRef.current = onVolumeChange;
  }, [onVolumeChange]);

  const dragRef = useRef<{ isDragging: boolean; startY: number; startVol: number }>({
    isDragging: false,
    startY: 0,
    startVol: 0,
  });

  const [activeDragging, setActiveDragging] = useState(false);

  // Formatting helper
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return "00:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Converts click/move client coordinates into the dial's corresponding volume (0.0 to 1.0)
  const getAngleAndVolume = (clientX: number, clientY: number): number => {
    if (!knobRef.current) return volumeRef.current;
    const rect = knobRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;

    // Angle relative to 12 o'clock (straight up) which maps naturally to a -180 to 180 range
    let angleDeg = Math.atan2(dx, -dy) * (180 / Math.PI);

    // The dial's visual sweep goes from -135 deg to +135 deg
    // If our angle is outside this range (the dead zone in the southern sector)
    if (angleDeg < -135) {
      return 0; // Hard stop at 0%
    } else if (angleDeg > 135) {
      return 1; // Hard stop at 100%
    } else {
      // Map the -135 to +135 degree range onto 0.0 to 1.0
      const pct = (angleDeg + 135) / 270;
      return Math.max(0, Math.min(1, pct));
    }
  };

  // Knob interaction scroll wheel
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const diff = e.deltaY < 0 ? 0.02 : -0.02; // Fine control (2% per mouse wheel tick)
    const nextVol = Math.max(0, Math.min(1, volumeRef.current + diff));
    onVolumeChangeRef.current(nextVol);
  };

  // Keyboard navigation support
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = 0.02; // Precise 2% increments on arrows
    if (e.key === "ArrowUp" || e.key === "ArrowRight") {
      e.preventDefault();
      onVolumeChangeRef.current(Math.min(1, volumeRef.current + step));
    } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
      e.preventDefault();
      onVolumeChangeRef.current(Math.max(0, volumeRef.current - step));
    }
  };

  // Modern robust pointer events for both mouse and touch input
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      isDragging: true,
      startY: e.clientY,
      startVol: volumeRef.current,
    };
    setActiveDragging(true);

    // Instant precise set on click
    const nextVol = getAngleAndVolume(e.clientX, e.clientY);
    onVolumeChangeRef.current(nextVol);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.isDragging) return;
    const nextVol = getAngleAndVolume(e.clientX, e.clientY);
    onVolumeChangeRef.current(nextVol);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current.isDragging) {
      dragRef.current.isDragging = false;
      setActiveDragging(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (err) {
        // Safe catch
      }
    }
  };

  // Volume rot angle (from -135deg to +135deg)
  const rotationAngle = -135 + volume * 270;

  // Render dummy spectrum animation blocks
  const [frequencies, setFrequencies] = useState<number[]>(Array(16).fill(0));

  useEffect(() => {
    let animationId: number;
    let lastTime = 0;

    const tick = (time: number) => {
      if (time - lastTime > 65) { // Throttle visualizer state changes
        if (isPlaying) {
          setFrequencies(
            Array(16)
              .fill(0)
              .map(() => Math.floor(Math.random() * 8) + 1)
          );
        } else {
          setFrequencies((prev) => prev.map((v) => Math.max(0, v - 1)));
        }
        lastTime = time;
      }
      animationId = requestAnimationFrame(tick);
    };

    animationId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying]);

  return (
    <div
      id="double-din-container"
      className="w-full max-w-xl mx-auto rounded-3xl bg-gradient-to-b from-[#2d313f] via-[#101217] to-[#040507] border-4 border-[#3c4154] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),inset_0_3px_6px_rgba(255,255,255,0.15)] p-4 relative high-gloss-reflection overflow-hidden"
    >
      {/* Dynamic Alpine-style silver side panel inserts */}
      <div className="absolute top-0 bottom-0 left-0 w-2.5 bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 border-r border-[#1a1c24]" />
      <div className="absolute top-0 bottom-0 right-0 w-2.5 bg-gradient-to-l from-slate-900 via-slate-700 to-slate-900 border-l border-[#1a1c24]" />

      {/* Top Deck: CD/DVD Slot Drive Decoration */}
      <div className="w-full mb-3 px-6 flex items-center justify-between">
        <div className="flex-1 max-w-[280px] h-2 bg-gradient-to-b from-[#12141a] to-[#252a36] rounded-full border border-slate-700/60 shadow-inner relative overflow-hidden flex items-center px-4">
          {/* Blue LED inside CD drive */}
          <div className="absolute inset-x-20 top-0.5 bottom-0.5 bg-blue-500/50 blur-[2px] animate-pulse shadow-[0_0_10px_#3adbff]" />
        </div>
        <div className="flex items-center gap-1.5 ml-4">
          <span className="text-[7px] font-mono tracking-widest text-[#3adbff] drop-shadow-[0_0_2px_rgba(58,219,255,0.4)] uppercase font-bold">DISC</span>
          <button
            onClick={onStop}
            className="w-5 h-4 rounded bg-[#09152b] border border-blue-500/50 flex items-center justify-center hover:bg-blue-900/30 hover:border-blue-450 text-blue-400 shadow-[0_0_6px_rgba(0,180,255,0.5)] active:scale-90 transition-all cursor-pointer"
            title="Eject / Force Stop"
          >
            <span className="text-[8px] drop-shadow-[0_0_2px_rgba(58,219,255,0.75)]">▲</span>
          </button>
        </div>
      </div>

      {/* Middle Deck: Faceplate Panel layout */}
      <div className="grid grid-cols-12 gap-3.5 relative z-10">
        
        {/* LEFT COLUMN PANEL: Tactile Rotary volume dial & Backlit Special function buttons */}
        <div className="col-span-3 flex flex-col items-center justify-between py-1.5 gap-3 border-r border-[#1a1e2b] pr-1.5">
          {/* ALPINE Inspired up/down triangle seek arrows */}
          <div className="flex flex-col gap-1.5 w-full items-center">
            <button
              onClick={onPrev}
              className="w-10 h-6 rounded-md bg-gradient-to-b from-[#131b2e] to-[#040814] border border-blue-500/60 shadow-[0_0_8px_rgba(58,219,255,0.35)] flex items-center justify-center hover:from-[#1d2d4e] hover:border-blue-300 active:scale-95 text-blue-400 hover:text-white transition-all cursor-pointer group"
              title="Track Back"
            >
              <SkipBack className="w-3.5 h-3.5 drop-shadow-[0_0_4px_#3adbff] group-hover:scale-105 duration-150" />
            </button>
            <span className="text-[6.5px] font-mono text-sky-400 drop-shadow-[0_0_3px_rgba(58,219,255,0.5)] tracking-tight uppercase font-black">TRACK</span>
            <button
              onClick={onNext}
              className="w-10 h-6 rounded-md bg-gradient-to-b from-[#131b2e] to-[#040814] border border-blue-500/60 shadow-[0_0_8px_rgba(58,219,255,0.35)] flex items-center justify-center hover:from-[#1d2d4e] hover:border-blue-300 active:scale-95 text-blue-400 hover:text-white transition-all cursor-pointer group"
              title="Track Next"
            >
              <SkipForward className="w-3.5 h-3.5 drop-shadow-[0_0_4px_#3adbff] group-hover:scale-105 duration-150" />
            </button>
          </div>

          {/* Glowing Translucent Backlit MENU / AUDIO Button */}
          <button
            onClick={onToggleShuffle}
            className={`w-11 h-7 rounded-sm border select-none font-mono text-[7px] font-black tracking-tighter uppercase transition-all duration-300 flex flex-col items-center justify-center cursor-pointer shadow-md ${
              shuffleMode
                ? "bg-blue-500/40 hover:bg-blue-500 border-sky-400 text-white shadow-[0_0_15px_rgba(58,219,255,0.7),inset_0_1px_3px_rgba(255,255,255,0.3)]"
                : "bg-[#0b101d] hover:bg-[#141f38] border-blue-500/50 text-blue-400 hover:text-sky-300 shadow-[0_0_10px_rgba(59,130,246,0.35)]"
            }`}
          >
            <Shuffle className="w-2.5 h-2.5 mb-0.5" />
            SHUFFLE
          </button>

          {/* PHYSICAL ROTARY VOLUME DIAL */}
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[7.5px] font-mono text-sky-300 drop-shadow-[0_0_3px_rgba(58,219,255,0.5)] tracking-widest uppercase font-bold">VOLUME</span>
            <div
              ref={knobRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onWheel={handleWheel}
              onKeyDown={handleKeyDown}
              tabIndex={0}
              className={`w-16 h-16 bg-gradient-to-br from-[#060b19] via-[#1a2e5c] to-[#040814] rounded-full border-2 border-blue-500 flex items-center justify-center relative cursor-pointer select-none touch-none transition-shadow duration-200 outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07090f] ${
                activeDragging ? "shadow-[0_0_25px_rgba(58,219,255,0.8),inset_0_1px_4px_rgba(255,255,255,0.3)] border-sky-400" : "shadow-[0_0_15px_rgba(0,180,255,0.5),inset_0_1px_3px_rgba(255,255,255,0.2)]"
              }`}
              title="Tactile Volume Rotary Dial. Drag around in a circle, scroll wheel, or use arrow keys."
            >
              {/* Surrounding illuminated Volume LED collar path */}
              <div
                className="absolute inset-x-[-3px] inset-y-[-3px] rounded-full border border-sky-400/40 pointer-events-none animate-pulse"
                style={{
                  boxShadow: `0 0 14px rgba(58, 219, 255, ${0.4 + volume * 0.4})`
                }}
              />

              {/* Brushed-Metal Texture Ring line overlay */}
              <div className="absolute inset-1.5 rounded-full border border-blue-400/20 pointer-events-none" />

              {/* Rotatable center grip cap with reference notch mark */}
              <motion.div
                className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#050b1d] to-[#1e346b] border border-blue-400/60 flex items-center justify-center shadow-lg relative"
                style={{ rotate: rotationAngle }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
              >
                {/* Physical pointer notch mark */}
                <div className="absolute top-1 left-1/2 w-1.5 h-1.5 -ml-0.75 bg-[#3adbff] rounded-full shadow-[0_0_10px_#3adbff] pointer-events-none" />
              </motion.div>

              {/* Center chrome jewel */}
              <div className="absolute w-3 h-3 rounded-full bg-gradient-to-b from-sky-300/30 to-black/60 border border-blue-400 pointer-events-none" />
            </div>
            
            {/* Volume feedback badge */}
            <span className="text-[8.5px] font-mono text-[#3adbff] drop-shadow-[0_0_4px_#3adbff] uppercase font-bold tracking-widest mt-0.5">
              VOL: {Math.round(volume * 100)}%
            </span>
          </div>

        </div>

        {/* CENTER INTERACTIVE HOODED LCD SCREEN PANEL */}
        <div className="col-span-9 flex flex-col bg-[#07090f] border-2 border-[#1a1e2b] rounded-xl p-3 shadow-[inset_0_4px_16px_rgba(0,0,0,0.95)] relative overflow-hidden select-none min-h-[190px] justify-between">
          
          {/* LCD Gloss glass shine reflection overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/2 to-white/6 pointer-events-none z-10 rounded-xl" />
          
          {/* Screen top status ticker line */}
          <div className="flex items-center justify-between text-[7.5px] font-mono tracking-widest text-[#5d6780] uppercase border-b border-slate-900/50 pb-1.5 z-20">
            <span className="flex items-center gap-1 font-bold text-slate-500">
              <Radio className="w-2.5 h-2.5 text-slate-500" />
              THUMPLAYER.AI
            </span>
            <div className="flex items-center gap-2">
              {shuffleMode && (
                <span className="text-blue-400 drop-shadow-[0_0_3px_rgba(59,130,246,0.5)] font-black">
                  [SHUF]
                </span>
              )}
              {isMaxBass && (
                <span className="text-red-500 drop-shadow-[0_0_3px_rgba(239,68,68,0.5)] font-black animate-pulse">
                  [MAX_BASS]
                </span>
              )}
              <span className="text-[#3adbff] font-bold">{headunitTime}</span>
            </div>
          </div>

          {/* MAIN BALANCED DISPLAY PANEL (Central Screen) */}
          <div className="my-auto flex flex-col items-center justify-center py-2 relative z-20">
            {currentTrack ? (
              <div className="w-full text-center flex flex-col items-center justify-center">
                {/* Simulated Glass-Sheath Text Window */}
                <div className="w-full overflow-hidden whitespace-nowrap mb-1">
                  <p className="inline-block text-sm md:text-base font-mono font-black text-[#3adbff] tracking-wider drop-shadow-[0_0_8px_#3adbff] uppercase animate-marquee">
                    {currentTrack.name}
                  </p>
                </div>
                
                {/* Metadata details line */}
                <span className="text-[10px] font-mono text-sky-300 tracking-widest uppercase mb-1.5 font-bold truncate max-w-[280px]">
                  {currentTrack.artist || "No Tag Artist"} // {currentTrack.album || "No Tag Album"}
                </span>

                {/* Simulated Track Progress timeline bar */}
                <div className="w-full max-w-[240px] mt-1 flex flex-col gap-1 items-stretch">
                  <div className="flex items-center justify-between text-[9px] font-mono text-[#3adbff] font-bold tracking-widest">
                    <span>{formatTime(songProgress)}</span>
                    <span className="text-slate-500">/</span>
                    <span>{formatTime(songDuration || currentTrack.duration)}</span>
                  </div>
                  {/* Progress timeline click/seek rail wrapper */}
                  <div 
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const ratio = (e.clientX - rect.left) / rect.width;
                      onSeek(ratio * (songDuration || currentTrack.duration || 120));
                    }}
                    className="h-1.5 bg-[#0e121d] rounded-full border border-slate-800 relative cursor-pointer group"
                  >
                    <div 
                      className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-[#00b0ff] to-[#3adbff] rounded-full shadow-[0_0_6px_rgba(58,219,255,0.7)]"
                      style={{ width: `${Math.min(100, ((songProgress / (songDuration || currentTrack.duration || 120)) * 100))}%` }}
                    />
                    <div 
                      className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full border-2 border-[#3adbff] shadow-md scale-0 group-hover:scale-110 transition-transform"
                      style={{ left: `${Math.min(98, ((songProgress / (songDuration || currentTrack.duration || 120)) * 100))}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center flex flex-col items-center justify-center opacity-45">
                <span className="text-sm font-mono font-black text-[#3adbff]/50 uppercase tracking-wider">
                  No Track Loaded
                </span>
                <span className="text-[9px] font-mono text-slate-500 tracking-wider uppercase mt-1">
                  Select or upload a song below to start playing
                </span>
              </div>
            )}
          </div>

          {/* LOWER SECTION: Micro Spectrum segment rows & active labels */}
          <div className="flex items-end justify-between border-t border-slate-900/50 pt-2 z-20">
            {/* Audio Type Badges */}
            <div className="flex flex-col gap-0.5 text-left">
              <span className="text-[8px] font-mono font-bold text-[#3ea4f9] uppercase tracking-wider">
                SOURCE: <span className="text-white bg-blue-900/60 border border-blue-500/20 px-1 py-0.2 rounded">MY LIBRARY</span>
              </span>
              <span className="text-[7px] font-mono text-slate-500 uppercase tracking-tight font-extrabold flex items-center gap-1 mt-0.5">
                <Disc className={`w-2.5 h-2.5 ${isPlaying ? "animate-spin text-blue-400" : ""}`} />
                High-Resolution Audio
              </span>
            </div>

            {/* RETRO DANCING LCD EQUALIZER SPECTRUM */}
            <div className="flex items-end gap-[2px] h-6 px-1 border-l border-slate-900/60 pl-3">
              {frequencies.map((lev, idx) => (
                <div key={idx} className="flex flex-col-reverse justify-end gap-[1px] w-[3.5px] h-full">
                  {Array.from({ length: 8 }).map((_, segmentIdx) => {
                    const isActive = segmentIdx < lev;
                    // Segment coloring from bottom (green) to top (red)
                    let segmentBg = "bg-slate-905";
                    if (isActive) {
                      if (segmentIdx >= 6) {
                        segmentBg = "bg-[#f43f5e] shadow-[0_0_2px_#f43f5e]";
                      } else if (segmentIdx >= 4) {
                        segmentBg = "bg-[#fb923c] shadow-[0_0_2px_#fb923c]";
                      } else {
                        segmentBg = "bg-[#3adbff] shadow-[0_0_2px_#3adbff]";
                      }
                    } else {
                      segmentBg = "bg-slate-900/70";
                    }
                    return (
                      <div
                        key={segmentIdx}
                        className={`w-full h-[2.2px] rounded-xs transition-colors duration-100 ${segmentBg}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* LOWER PANEL: Bottom Solid Bezel Buttons strip */}
      <div className="mt-4 pt-3.5 border-t border-[#1b233a] flex items-center justify-center gap-2 px-1 relative z-10">
        
        {/* SKIP BACK BUTTON */}
        <motion.button
          whileTap={{ scale: 0.92, y: 1.5 }}
          onClick={onPrev}
          className="flex-1 max-w-[80px] h-9 rounded-md bg-gradient-to-b from-[#0b101d] to-[#04060c] border border-blue-500/65 shadow-[0_0_10px_rgba(0,180,255,0.25)] flex flex-col items-center justify-center hover:from-[#131c33] hover:border-blue-300 cursor-pointer text-blue-400 hover:text-white transition-all group"
          title="Skip Backwards"
        >
          <SkipBack className="w-4.5 h-4.5 text-blue-400 drop-shadow-[0_0_4px_rgba(58,219,255,0.7)] group-hover:scale-105 duration-150" />
          <span className="text-[6.5px] font-mono font-bold tracking-tighter mt-0.5 text-sky-300 drop-shadow-[0_0_2px_rgba(58,219,255,0.5)]">PREVIOUS</span>
        </motion.button>

        {/* STOP BUTTON */}
        <motion.button
          whileTap={{ scale: 0.92, y: 1.5 }}
          onClick={onStop}
          className="flex-1 max-w-[80px] h-9 rounded-md bg-gradient-to-b from-[#0b101d] to-[#04060c] border border-blue-500/65 shadow-[0_0_10px_rgba(0,180,255,0.25)] flex flex-col items-center justify-center hover:from-[#131c33] hover:border-blue-300 cursor-pointer text-blue-400 hover:text-white transition-all group"
          title="Stop Track"
        >
          <Square className="w-4 h-4 text-red-500 drop-shadow-[0_0_4px_rgba(239,68,68,0.7)] group-hover:scale-105 duration-150" />
          <span className="text-[6.5px] font-mono font-bold tracking-tighter mt-0.5 text-sky-300 drop-shadow-[0_0_2px_rgba(58,219,255,0.5)]">STOP</span>
        </motion.button>

        {/* PRIMARY PLAY / PAUSE BUTTON */}
        <motion.button
          whileTap={{ scale: 0.92, y: 1.5 }}
          onClick={onPlayPause}
          className={`flex-[1.5] max-w-[125px] h-9.5 rounded-md border flex flex-col items-center justify-center cursor-pointer transition-all ${
            isPlaying
              ? "bg-gradient-to-b from-[#0e3b2e] to-[#031c15] border-emerald-400 text-white shadow-[0_0_18px_rgba(16,185,129,0.5),0_0_8px_rgba(0,180,255,0.45)]"
              : "bg-gradient-to-b from-[#0a182e] to-[#020712] border-blue-500 shadow-[0_0_15px_rgba(58,219,255,0.45)] hover:border-sky-400 hover:from-[#10274c] text-[#3adbff] hover:text-white"
          }`}
          title={isPlaying ? "Click to Pause" : "Click to Play"}
        >
          <div className="flex items-center gap-1.5">
            {isPlaying ? (
              <Pause className="w-4 h-4 animate-pulse text-emerald-300 drop-shadow-[0_0_4px_#10b981]" />
            ) : (
              <Play className="w-4 h-4 text-[#3adbff] drop-shadow-[0_0_5px_#3adbff]" />
            )}
          </div>
          <span className={`text-[7.5px] font-mono font-black tracking-widest mt-0.5 ${isPlaying ? "text-emerald-300 drop-shadow-[0_0_2px_rgba(16,185,129,0.6)]" : "text-sky-300 drop-shadow-[0_0_3px_rgba(58,219,255,0.6)]"}`}>
            {isPlaying ? "PAUSE" : "PLAY"}
          </span>
        </motion.button>

        {/* SKIP FORWARD BUTTON */}
        <motion.button
          whileTap={{ scale: 0.92, y: 1.5 }}
          onClick={onNext}
          className="flex-1 max-w-[80px] h-9 rounded-md bg-gradient-to-b from-[#0b101d] to-[#04060c] border border-blue-500/65 shadow-[0_0_10px_rgba(0,180,255,0.25)] flex flex-col items-center justify-center hover:from-[#131c33] hover:border-blue-300 cursor-pointer text-blue-400 hover:text-white transition-all group"
          title="Skip Forward"
        >
          <SkipForward className="w-4.5 h-4.5 text-blue-400 drop-shadow-[0_0_4px_rgba(58,219,255,0.7)] group-hover:scale-105 duration-150" />
          <span className="text-[6.5px] font-mono font-bold tracking-tighter mt-0.5 text-sky-300 drop-shadow-[0_0_2px_rgba(58,219,255,0.5)]">NEXT</span>
        </motion.button>

        {/* ATOMIC MAX BASS BUTTON */}
        <motion.button
          whileTap={{ scale: 0.92, y: 1.5 }}
          onClick={onToggleMaxBass}
          className={`flex-1 max-w-[85px] h-9 rounded-md border flex flex-col items-center justify-center cursor-pointer font-black tracking-tight uppercase transition-all duration-300 text-center shadow-md ${
            isMaxBass
              ? "bg-[#3f0808] text-red-100 border-red-500 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.8),0_0_10px_rgba(58,219,255,0.5)]"
              : "bg-gradient-to-b from-[#0b101d] to-[#04060c] hover:bg-[#131c33] border-blue-500/50 text-red-500 hover:text-red-400 shadow-[0_0_10px_rgba(58,219,255,0.2)]"
          }`}
          title="Max Bass Booster"
        >
          <span className="text-[8px] font-black tracking-tighter scale-95 drop-shadow-[0_0_3px_rgba(239,68,68,0.4)]">💥 MAX BASS</span>
          <span className="text-[6.5px] font-mono tracking-tighter text-sky-300 drop-shadow-[0_0_2px_rgba(58,219,255,0.4)]">BOOST</span>
        </motion.button>

      </div>

      {/* Decorative branding badges & screws for dashboard immersion */}
      <div className="absolute top-2.5 left-5 w-1 h-1 rounded-full bg-slate-950/70 border-t border-slate-600/30" />
      <div className="absolute top-2.5 right-5 w-1 h-1 rounded-full bg-slate-950/70 border-t border-slate-600/30" />
      <div className="absolute bottom-2 left-5 w-1 h-1 rounded-full bg-slate-950/70 border-t border-slate-600/30" />
      <div className="absolute bottom-2 right-5 w-1 h-1 rounded-full bg-slate-950/70 border-t border-slate-600/30" />
    </div>
  );
}
