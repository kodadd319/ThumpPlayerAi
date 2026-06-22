import React from "react";
import { 
  Crown, 
  Check, 
  Sparkles, 
  Sliders, 
  ArrowLeft,
  Volume2,
  Lock,
  Music,
  ArrowRight
} from "lucide-react";
import { motion } from "motion/react";

interface UpgradeViewProps {
  onBackToPlayer: () => void;
  subscriptionTier: "free" | "paid";
  onChangeSubscriptionTier: (tier: "free" | "paid") => void;
  globalPremiumPrompt?: string;
}

export const UpgradeView: React.FC<UpgradeViewProps> = ({ 
  onBackToPlayer, 
  subscriptionTier, 
  onChangeSubscriptionTier,
  globalPremiumPrompt
}) => {

  const handleUpgrade = () => {
    // Simulate upgrading the tier to paid so the user gets real-time access
    onChangeSubscriptionTier("paid");
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-6"
    >
      {/* Return Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToPlayer}
          className="px-4 py-2 rounded-xl border border-slate-800 bg-[#0b0f19]/90 text-slate-400 hover:text-[#3adbff] hover:border-[#3adbff]/30 font-mono text-[10px] uppercase tracking-wider flex items-center gap-2 transition-all duration-150 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Music Player
        </button>

        {/* Subscription Status Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/45 border border-slate-850">
          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">Status:</span>
          <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase transition-all tracking-wider ${
            subscriptionTier === "paid" 
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
              : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
          }`}>
            {subscriptionTier === "paid" ? "Premium Active" : "Free Tier"}
          </span>
        </div>
      </div>

      {/* Premium Notification Warning Banner */}
      {globalPremiumPrompt && subscriptionTier !== "paid" && (
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 text-amber-300 flex items-start gap-4 shadow-[0_4px_20px_rgba(245,158,11,0.08)]"
        >
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex flex-col gap-0.5">
            <h4 className="font-mono text-[10px] font-black uppercase tracking-wider text-amber-400">
              Premium Action Required
            </h4>
            <p className="font-sans text-[11px] text-slate-300 leading-relaxed font-semibold">
              {globalPremiumPrompt}
            </p>
          </div>
        </motion.div>
      )}

      {/* Main Upgrade Card */}
      <div className="relative rounded-3xl bg-gradient-to-b from-[#111625] to-[#04060c] border-2 border-slate-800 p-6 md:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.85)] overflow-hidden">
        {/* Decorative ambient backdrop glow */}
        <div className="absolute -top-32 -left-30 w-72 h-72 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-32 -right-30 w-72 h-72 bg-emerald-600/15 rounded-full blur-[120px] pointer-events-none" />

        {/* Crown Badge */}
        <div className="absolute top-6 right-6 bg-gradient-to-r from-sky-450 to-[#3adbff] text-[9px] font-mono text-black font-black uppercase px-3 py-1 rounded-full tracking-widest shadow-[0_0_15px_rgba(58,219,255,0.35)] flex items-center gap-1.5 z-10 select-none">
          <Crown className="w-3 h-3" />
          PREMIUM
        </div>

        {/* Title */}
        <div className="flex flex-col gap-2 border-b border-slate-800/80 pb-6 max-w-xl">
          <h2 className="font-mono text-lg md:text-xl font-bold tracking-tight text-white flex items-center gap-2">
            Upgrade to Premium
          </h2>
          <p className="text-[11px] font-mono text-slate-400 uppercase tracking-widest leading-relaxed">
            Unlock professional AI sound engineering of your custom tracks.
          </p>
        </div>

        {/* Feature List */}
        <div className="my-8">
          <h3 className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#3adbff] mb-4">
            Exclusive Premium Features
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Feature 1 */}
            <div className="flex gap-3.5 items-start p-3 rounded-xl hover:bg-slate-900/40 transition-colors">
              <div className="w-7 h-7 bg-blue-500/10 rounded-lg flex items-center justify-center border border-blue-500/20 shrink-0">
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h4 className="text-[11px] font-mono font-bold uppercase tracking-wide text-white">
                  AI Sound Quality Enhancement
                </h4>
                <p className="text-[10px] font-sans text-slate-400 mt-1 leading-relaxed">
                  Cleans and remasters your audio files for high-fidelity studio clarity.
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="flex gap-3.5 items-start p-3 rounded-xl hover:bg-slate-900/40 transition-colors">
              <div className="w-7 h-7 bg-blue-500/10 rounded-lg flex items-center justify-center border border-blue-500/20 shrink-0">
                <Sliders className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h4 className="text-[11px] font-mono font-bold uppercase tracking-wide text-white">
                  AI Vehicle Acoustic Calibrator
                </h4>
                <p className="text-[10px] font-sans text-slate-400 mt-1 leading-relaxed">
                  Calibrates audio frequencies perfectly for your vehicle's unique cabin size.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="flex gap-3.5 items-start p-3 rounded-xl hover:bg-slate-900/40 transition-colors">
              <div className="w-7 h-7 bg-blue-500/10 rounded-lg flex items-center justify-center border border-blue-500/20 shrink-0">
                <Volume2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h4 className="text-[11px] font-mono font-bold uppercase tracking-wide text-white">
                  3 Premium EQ Presets
                </h4>
                <p className="text-[10px] font-sans text-slate-400 mt-1 leading-relaxed">
                  Unlocks three new custom presets for the 5-band equalizer.
                </p>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="flex gap-3.5 items-start p-3 rounded-xl hover:bg-slate-900/40 transition-colors">
              <div className="w-7 h-7 bg-blue-500/10 rounded-lg flex items-center justify-center border border-blue-500/20 shrink-0">
                <Music className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h4 className="text-[11px] font-mono font-bold uppercase tracking-wide text-white">
                  Unlimited Track Uploads
                </h4>
                <p className="text-[10px] font-sans text-slate-400 mt-1 leading-relaxed">
                  Upload as many songs as you want without restrictions.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 pt-4 border-t border-slate-800">
          
          {/* Monthly Subscription */}
          <div className="p-5 rounded-2xl bg-slate-950/45 border border-slate-800/80 flex flex-col justify-between relative group hover:border-[#3adbff]/30 transition-all">
            <div>
              <span className="text-[8px] font-mono font-bold text-blue-400 uppercase tracking-widest block mb-1">
                Flexible Plan
              </span>
              <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                Monthly Subscription
              </h4>
              <div className="my-3 flex items-baseline gap-1.5">
                <span className="text-base md:text-lg font-mono font-black text-white">$10.00</span>
                <span className="text-[10px] font-sans text-slate-300">first month</span>
              </div>
              <p className="text-[9px] font-mono text-slate-500 uppercase tracking-wider mb-5">
                then rebills monthly at $20.00
              </p>
            </div>
            <button
              onClick={handleUpgrade}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 font-mono text-[10px] font-bold tracking-widest text-white uppercase cursor-pointer transition-all active:scale-[98.5%] shadow-lg border-t border-white/10 flex items-center justify-center gap-1.5"
            >
              <span>Upgrade</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Annual Subscription */}
          <div className="p-5 rounded-2xl bg-gradient-to-b from-[#0e2124] to-[#04090b] border-2 border-emerald-500/40 flex flex-col justify-between relative group hover:border-emerald-400/60 transition-all shadow-[0_5px_15px_rgba(16,185,129,0.08)]">
            <div className="absolute top-3 right-3 bg-emerald-500 text-[6.5px] font-mono text-black font-black uppercase px-2 py-0.5 rounded tracking-wider shadow">
              SAVE 50%
            </div>
            <div>
              <span className="text-[8px] font-mono font-bold text-emerald-400 uppercase tracking-widest block mb-1">
                Value Saver Plan
              </span>
              <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                Annual Subscription
              </h4>
              <div className="my-3 flex items-baseline gap-1.5">
                <span className="text-base md:text-lg font-mono font-black text-emerald-400">$80.00</span>
                <span className="text-[10px] font-sans text-slate-300">first year</span>
              </div>
              <p className="text-[9px] font-mono text-sky-400 uppercase tracking-wider mb-5 font-bold">
                then rebills yearly at $100.00
              </p>
            </div>
            <button
              onClick={handleUpgrade}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-600 to-[#3adbff] hover:from-sky-500 hover:to-sky-400 font-mono text-[10px] font-black tracking-widest text-[#0e0e0e] uppercase cursor-pointer transition-all active:scale-[98.5%] shadow-lg border-t border-white/15 bg-sky-500 flex items-center justify-center gap-1.5"
            >
              <span>Upgrade</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

        {/* Footer Billing Info */}
        <p className="text-[8px] font-mono text-slate-500 text-center uppercase tracking-widest mt-6">
          Billed securely via checkout portal. 256-bit encryption. Cancel anytime.
        </p>
      </div>

      {/* Subscription Quick Toggles for Testing */}
      {subscriptionTier === "paid" && (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          className="p-4 rounded-xl border border-emerald-500/25 bg-emerald-950/20 text-emerald-400 text-center"
        >
          <div className="font-mono text-[10px] uppercase font-bold tracking-widest">
            🎉 Premium Status Simulated Successfully!
          </div>
          <p className="text-[9px] mt-1 text-slate-400 uppercase tracking-wider">
            You now have unlimited track uploads and can test premium equalizer presets!
          </p>
          <button 
            onClick={() => onChangeSubscriptionTier("free")}
            className="mt-2.5 px-3 py-1 bg-red-950/35 border border-red-900/50 hover:bg-red-900/35 text-red-400 rounded text-[8px] font-mono uppercase tracking-widest transition-all cursor-pointer"
          >
            Switch back to Free Tier
          </button>
        </motion.div>
      )}
    </motion.div>
  );
};
