import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Lazy load Gemini to prevent crashes if key is initially absent
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      // Create client anyway but let's warn. Oh, GoogleGenAI throws if key is empty?
      // No, we can pass whatever or handle it.
      console.warn("GEMINI_API_KEY is not defined. AI customization will fallback to local calculations.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key || "PLACEHOLDER_KEY",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

const app = express();
const PORT = 3000;

app.use(express.json());

// API route for AI-based Audio Optimization
app.post("/api/optimize", async (req, res) => {
  try {
    const { songTitle, genre, vehicleType, subwooferConfig, soundPreference } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      // Elegant fallback when API key is missing
      return res.json({
        success: true,
        isFallback: true,
        eqBands: calculateFallbackEq(genre, soundPreference),
        bassBoost: soundPreference.includes("Basshead") || soundPreference.includes("SPL") ? 9 : soundPreference.includes("Loud") || soundPreference.includes("SQL") ? 7 : 4,
        reverbWet: vehicleType.includes("SUV") || vehicleType.includes("Yacht") ? 0.16 : vehicleType.includes("Hatch") ? 0.04 : 0.09,
        delayOffsetMs: vehicleType.includes("Sedan") ? 13 : vehicleType.includes("SUV") || vehicleType.includes("Yacht") ? 18 : 9,
        highPassFilterHz: subwooferConfig.includes("stock") ? 48 : 32,
        subCrossoverHz: subwooferConfig.includes("15") || subwooferConfig.includes("Wall") ? 75 : subwooferConfig.includes("12") ? 80 : 90,
        justification: "Tuned by the local Street Audio DSP Engine! Since we are running in local fallback cruiser mode, we've calibrated your cabinet volume against your subwoofer config to give you a punchy, crisp, window-rattling street block tune without blowing your door coaxial voice coils. Enjoy this solid street beat!"
      });
    }

    const ai = getAiClient();
    const prompt = `You are a legendary, friendly Car Audio Competition DSP (Digital Signal Processor) tuning crew chief. 
Speak in a highly engaging, fusion style that marries light "urban terminology" (like whip, trunk slam, cruising, rattling windows, tight beats, front stage, block party) with technical, accurate "car audio jargon" (like DSP, crossover frequency, high-pass infrasonic filter, decibels, speaker phase, cabin gain, time alignment). 
Your output must be simple to understand, super user-friendly, and show the user exactly why this tune rocks their specific ride.

Analyze this street ride setup and track:
- Track Current Vibe: "${songTitle || "Unknown Beats"}" (${genre || "No Genre"})
- Whip / Vehicle Ride: "${vehicleType || "Cruising Sedan"}"
- Subwoofer Trunk Setup: "${subwooferConfig || "Single 12\" Ported"}"
- Tuning Style Preference: "${soundPreference || "Loud & Crisp"}"

Generate the ultimate calibrated DSP parameters. Keep values realistic:
1. Five EQ band gains (60Hz, 250Hz, 1kHz, 4kHz, 16kHz) in dB (range -12 to +12).
2. Bass Boost level (range 0 to 10).
3. Virtual Cab Reverb Wet ratio (0.0 to 0.4) to match the interior cubic airspace.
4. Left-channel speaker time-alignment delay offset (0 to 30ms) so vocals lock dead center on your driver seat.
5. Infrasonic High-Pass Filter safety frequency (20 to 60Hz) to shield sub cone over-excursion on deep drops.
6. Subwoofer Low-Pass Crossover frequency (60 to 120Hz) to separate the heavy bass from the door mids.
7. One high-octane engineering summary outlining why these settings will make this track slam beautifully in their specific cabinet airspace without distorting mid-vocals. Ready, set, drop!`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            eqBands: {
              type: Type.ARRAY,
              description: "5 elements corresponding to gains in dB at 60Hz, 250Hz, 1kHz, 4kHz, and 16kHz.",
              items: { type: Type.NUMBER }
            },
            bassBoost: {
              type: Type.NUMBER,
              description: "Sub-bass boost knob level from 0 to 10."
            },
            reverbWet: {
              type: Type.NUMBER,
              description: "Simulated cabin room wetness multiplier from 0.0 to 0.4."
            },
            delayOffsetMs: {
              type: Type.NUMBER,
              description: "Time alignment offset in ms for driver side speaker correction (0 to 30)."
            },
            highPassFilterHz: {
              type: Type.NUMBER,
              description: "Infrasonic rumble cut-off frequency in Hz (20 to 60)."
            },
            subCrossoverHz: {
              type: Type.NUMBER,
              description: "Subwoofer crossover cut-off point in Hz (60 to 120)."
            },
            justification: {
              type: Type.STRING,
              description: "Friendly, enthusiastic, urban-meets-tech explanation of the tuning layout."
            }
          },
          required: ["eqBands", "bassBoost", "reverbWet", "delayOffsetMs", "highPassFilterHz", "subCrossoverHz", "justification"]
        }
      }
    });

    const dspConfig = JSON.parse(response.text || "{}");
    // Sanity bounding of values
    if (Array.isArray(dspConfig.eqBands) && dspConfig.eqBands.length === 5) {
      dspConfig.eqBands = dspConfig.eqBands.map((v: number) => Math.max(-12, Math.min(12, v)));
    } else {
      dspConfig.eqBands = [0, 0, 0, 0, 0];
    }
    dspConfig.bassBoost = Math.max(0, Math.min(10, dspConfig.bassBoost || 0));
    dspConfig.reverbWet = Math.max(0, Math.min(0.4, dspConfig.reverbWet || 0));
    dspConfig.delayOffsetMs = Math.max(0, Math.min(30, dspConfig.delayOffsetMs || 0));
    dspConfig.highPassFilterHz = Math.max(20, Math.min(60, dspConfig.highPassFilterHz || 40));
    dspConfig.subCrossoverHz = Math.max(60, Math.min(120, dspConfig.subCrossoverHz || 80));

    res.json({
      success: true,
      ...dspConfig
    });
  } catch (error: any) {
    console.error("Gemini optimization error:", error);
    res.status(500).json({ error: "Failed to optimize audio profiles", details: error.message });
  }
});

function calculateFallbackEq(genre = "", soundPreference = ""): number[] {
  // Simple smart defaults
  const normalizedGenre = genre.toLowerCase();
  const isBassPreference = soundPreference === "SPL" || normalizedGenre.includes("rap") || normalizedGenre.includes("hip") || normalizedGenre.includes("bass") || normalizedGenre.includes("trap") || normalizedGenre.includes("edm") || normalizedGenre.includes("electro");
  
  if (isBassPreference) {
    return [8, 4, -2, 1, 3]; // Bass Head EQ
  } else if (soundPreference === "Vocal-centric" || normalizedGenre.includes("pop") || normalizedGenre.includes("vocal")) {
    return [-1, 2, 4, 3, 1]; // Enhanced Midranges for Vocals
  } else {
    return [4, 1, 0, 2, 3]; // SQL balanced curve
  }
}

// Dev and Prod serving
async function bootstrapServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Car Audio Player backend running on http://localhost:${PORT}`);
  });
}

bootstrapServer();
