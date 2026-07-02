export interface Track {
  id: string;
  name: string;
  artist: string;
  album: string;
  duration: number; // in seconds
  file?: File;
  url?: string;
  genre: string;
  imageUrl?: string;
  albumArtUrl?: string | null;
}

export interface DspSettings {
  eqBands: number[]; // 5 band values in dB (-12 to +12)
  bassBoost: number; // 0 to 10 scale
  reverbWet: number; // 0.0 to 0.4 scale
  delayOffsetMs: number; // 0 to 30 ms
  highPassFilterHz: number; // 20 to 60 Hz
  subCrossoverHz: number; // 60 to 120 Hz
  justification: string;
}

export interface VehicleInfo {
  vehicleType: "Hatchback" | "Sedan" | "SUV" | "Coupe" | "Truck" | string;
  subwooferConfig: "None" | "Single 10\" Sub" | "Single 12\" Sub" | "Dual 12\" Subs" | "Single 15\" Sub" | "Competition Wall" | string;
  soundPreference: "Balanced" | "SQL (Sound Quality Loud)" | "SPL (Maximum Bass Head)" | "Vocal-centric" | string;
}

export interface Preset {
  name: string;
  eqBands: number[];
  bassBoost: number;
  reverbWet: number;
  delayOffsetMs: number;
  isPremium?: boolean;
}

export interface VideoTrack {
  id: string;
  name: string;
  url: string;
  duration: string;
  creator: string;
  category: string;
  thumbnail: string;
}
