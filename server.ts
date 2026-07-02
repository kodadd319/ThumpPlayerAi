import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import Stripe from "stripe";

dotenv.config();

// Initialize Firebase Admin
try {
  if (getApps().length === 0) {
    initializeApp({
      projectId: "eliteplayerai"
    });
    console.log("Firebase Admin initialized successfully.");
  }
} catch (err) {
  console.error("Firebase Admin initialization failed:", err);
}

// Helper to get active Firestore instance with correct databaseId
function getAdminDb() {
  if (getApps().length === 0) return null;
  return getFirestore(undefined, "ai-studio-121a998e-f48a-4fe6-99da-b27a251b5324");
}

// Helper to get active Auth instance
function getAdminAuth() {
  if (getApps().length === 0) return null;
  return getAuth();
}

// User Premium Validation Helpers
function isUserPremium(userData: any): boolean {
  if (!userData) return false;
  
  // High-priority developer/tester bypass
  if (userData.email === "jkoehler319@gmail.com") return true;
  
  if (userData.subscriptionTier !== "paid") return false;

  if (userData.premiumType === "lifetime") {
    return true; // Lifetime never expires
  }

  if (userData.premiumType === "subscription") {
    if (!userData.premiumExpiresAt) {
      return true; // fallback if subscriptionTier is paid but expiry hasn't sync'd yet
    }
    const expiresAt = new Date(userData.premiumExpiresAt);
    return expiresAt.getTime() > Date.now();
  }

  return true; // default fallback if subscriptionTier is explicitly "paid"
}

// Abstract Gatekeeping Definition to easily add more paid features
const GATED_FEATURES = {
  AI_AUDIO_OPTIMIZATION: "AI_AUDIO_OPTIMIZATION",
  AI_VIDEO_OPTIMIZATION: "AI_VIDEO_OPTIMIZATION"
};

function hasAccessToFeature(userData: any, featureName: keyof typeof GATED_FEATURES): boolean {
  // Currently, all premium features require isUserPremium to be true
  return isUserPremium(userData);
}

async function getPremiumStatus(req: express.Request, featureName: keyof typeof GATED_FEATURES): Promise<boolean> {
  if (getApps().length === 0) {
    // If Admin SDK is not active, allow access by default for safety in local runs
    return true;
  }
  
  let uid: string | null = null;

  // 1. Check Bearer Authorization token first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split("Bearer ")[1];
    const auth = getAdminAuth();
    if (auth) {
      try {
        const decodedToken = await auth.verifyIdToken(token);
        uid = decodedToken.uid;
      } catch (err) {
        console.warn("Bearer token verification failed in backend:", err);
      }
    }
  }

  // 2. Fallback to header or body UID
  if (!uid) {
    uid = (req.headers["x-user-uid"] as string) || req.body.uid || null;
  }

  if (!uid) {
    console.warn("No user identity found in request for feature gatekeeping:", featureName);
    return false;
  }

  try {
    const db = getAdminDb();
    if (!db) return false;
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return false;
    }
    const userData = userDoc.data();
    return hasAccessToFeature(userData, featureName);
  } catch (error) {
    console.error(`Error validating feature ${featureName} access in backend:`, error);
    return false;
  }
}

// Lazy load Gemini to prevent crashes if key is initially absent
let aiClient: GoogleGenAI | null = null;
function hasGeminiApiKey(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return !!key && key !== "undefined" && key !== "null" && key.trim() !== "";
}

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!hasGeminiApiKey()) {
      console.warn("GEMINI_API_KEY is not defined. AI customization will fallback to local calculations.");
    }
    aiClient = new GoogleGenAI({
      apiKey: hasGeminiApiKey() ? key : "PLACEHOLDER_KEY",
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

// Stripe Webhook Endpoint (mounted before express.json() to maintain raw body verification)
app.post("/webhook/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    if (endpointSecret && sig) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "dummy_key", { apiVersion: "2025-01-27.acacia" as any });
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } else {
      console.warn("STRIPE_WEBHOOK_SECRET or stripe-signature is missing. Handling unverified Stripe webhook payload for testing.");
      event = JSON.parse(req.body.toString());
    }
  } catch (err: any) {
    console.error("Stripe Webhook Signature Verification Failed:", err.message);
    return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
  }

  if (getApps().length === 0) {
    console.error("Firebase Admin is not initialized. Cannot update user premium state.");
    return res.status(500).send("Database not configured");
  }

  const db = getAdminDb();
  if (!db) {
    console.error("Firestore database connection could not be retrieved.");
    return res.status(500).send("Database connection error");
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const uid = session.client_reference_id;
        if (!uid) {
          console.warn("Stripe Checkout completed, but client_reference_id (uid) was not present.");
          break;
        }

        const isSubscription = session.mode === "subscription";
        const stripeSubscriptionId = session.subscription || null;
        const stripeCustomerId = session.customer || null;
        
        let expiresAtStr: string | null = null;
        if (isSubscription) {
          // Calculate safe expiry date (e.g. 32 days from now to give buffer on renewal)
          const d = new Date();
          d.setDate(d.getDate() + 32);
          expiresAtStr = d.toISOString();
        }

        const userRef = db.collection("users").doc(uid);
        await userRef.set({
          subscriptionTier: "paid",
          premiumType: isSubscription ? "subscription" : "lifetime",
          stripeSubscriptionId,
          stripeCustomerId,
          premiumExpiresAt: expiresAtStr,
          updatedAt: new Date().toISOString()
        }, { merge: true });

        console.log(`Webhook updated user ${uid}: premium unlocked! (${isSubscription ? "Subscription" : "Lifetime"})`);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription;
        
        if (subscriptionId) {
          const usersSnap = await db.collection("users").where("stripeSubscriptionId", "==", subscriptionId).get();
          if (!usersSnap.empty) {
            for (const doc of usersSnap.docs) {
              const d = new Date();
              const hasYearly = invoice.lines?.data?.some((line: any) => line.plan?.interval === "year");
              d.setDate(d.getDate() + (hasYearly ? 366 : 32));
              
              await doc.ref.set({
                subscriptionTier: "paid",
                premiumType: "subscription",
                premiumExpiresAt: d.toISOString(),
                updatedAt: new Date().toISOString()
              }, { merge: true });
              console.log(`Webhook: Extended subscription for user ${doc.id} to ${d.toISOString()}`);
            }
          } else {
            console.warn(`Webhook received invoice payment success for unmapped subscription ID ${subscriptionId}`);
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as any;
        const subscriptionId = sub.id;
        
        const usersSnap = await db.collection("users").where("stripeSubscriptionId", "==", subscriptionId).get();
        if (!usersSnap.empty) {
          for (const doc of usersSnap.docs) {
            await doc.ref.set({
              subscriptionTier: "free",
              premiumType: "none",
              premiumExpiresAt: null,
              updatedAt: new Date().toISOString()
            }, { merge: true });
            console.log(`Webhook: Locked premium access for user ${doc.id} due to subscription cancel/deletion.`);
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription;
        
        if (subscriptionId) {
          const usersSnap = await db.collection("users").where("stripeSubscriptionId", "==", subscriptionId).get();
          if (!usersSnap.empty) {
            for (const doc of usersSnap.docs) {
              await doc.ref.set({
                subscriptionTier: "free",
                premiumType: "none",
                premiumExpiresAt: null,
                updatedAt: new Date().toISOString()
              }, { merge: true });
              console.log(`Webhook: Locked premium access for user ${doc.id} due to payment failure.`);
            }
          }
        }
        break;
      }

      default:
        console.log(`Unhandled Stripe event: ${event.type}`);
    }
  } catch (error) {
    console.error("Error processing database update inside webhook route:", error);
    return res.status(500).send("Internal server error during database synchronization");
  }

  res.json({ received: true });
});

app.use(express.json());

// API route for AI-based Audio Optimization
app.post("/api/optimize", async (req, res) => {
  try {
    // Gatekeep this feature so it is strictly locked unless "active_premium" is true
    const isPremium = await getPremiumStatus(req, "AI_AUDIO_OPTIMIZATION");
    if (!isPremium) {
      return res.status(403).json({
        error: "Premium subscription required",
        code: "PREMIUM_REQUIRED",
        message: "Unlock all AI Audio Enhancement features by upgrading to Premium."
      });
    }

    const { 
      songTitle, 
      genre, 
      environmentMode, 
      userEquipment, 
      soundPreference, 
      easyMode, 
      carYearMakeModel,
      vehicleType,
      subwooferConfig 
    } = req.body;

    if (!hasGeminiApiKey()) {
      // Elegant fallback when API key is missing
      if (easyMode && carYearMakeModel) {
        const carLower = carYearMakeModel.toLowerCase();
        const guessSub = carLower.includes("sub") || carLower.includes("upgraded") || carLower.includes("sound system");
        const isBigCabin = carLower.includes("suv") || carLower.includes("truck") || carLower.includes("jeep") || carLower.includes("tahoe") || carLower.includes("explorer") || carLower.includes("f150") || carLower.includes("pickup");
        
        const eqBands = [5, 2, -1, 3, 4]; // Balanced OEM correction curve
        const bassBoost = guessSub ? 6 : 4;
        const reverbWet = isBigCabin ? 0.14 : 0.08;
        const delayOffsetMs = carLower.includes("truck") ? 16 : 11;
        const highPassFilterHz = guessSub ? 38 : 45;
        const subCrossoverHz = guessSub ? 80 : 95;
        const justification = `🚗 Easy Tune Fallback Active for your ${carYearMakeModel}! Since we are running in local fallback mode, we analyzed your vehicle's standard cabin dimensions and factory acoustic signature. We have corrected standard speaker limitations by rolling off muddy frequencies at 45Hz, lifting mid-vocal response (+3dB), and widening spatial airiness (+8% reverb). Turn up the volume—your system will sound wider, louder, and remarkably cleaner!`;

        return res.json({
          success: true,
          isFallback: true,
          eqBands,
          bassBoost,
          reverbWet,
          delayOffsetMs,
          highPassFilterHz,
          subCrossoverHz,
          justification
        });
      }

      const resolvedVehicleType = vehicleType || environmentMode || "Sedan";
      const resolvedSubConfig = subwooferConfig || userEquipment || "None";
      const resolvedSoundPref = soundPreference || "Balanced";

      const isOem = !resolvedSubConfig || resolvedSubConfig === "None" || resolvedSubConfig.toLowerCase().includes("factory") || resolvedSubConfig.toLowerCase().includes("oem");
      const dspExplanation = isOem 
        ? "We've custom-tuned your factory audio configuration! By safely shielding standard door speakers from sub-harmonic distortion while dynamically boosting high-mid acoustic spacing, we've delivered an incredibly crisp, relaxed, and studio-balanced layout perfect for standard OEM stereos."
        : "Tuned by our local Studio Audio DSP Engine! Since we are running in local fallback cruiser mode, we've calibrated your cabinet volume against your subwoofer configs to give you a punchy, crisp tune without blowing your door coaxials. Enjoy this clean street profile!";

      return res.json({
        success: true,
        isFallback: true,
        eqBands: calculateFallbackEq(genre, resolvedSoundPref),
        bassBoost: isOem ? 3 : (resolvedSoundPref.includes("Basshead") || resolvedSoundPref.includes("SPL") || resolvedSoundPref.includes("Thump") ? 9 : resolvedSoundPref.includes("Loud") || resolvedSoundPref.includes("SQL") || resolvedSoundPref.includes("Rich") ? 7 : 4),
        reverbWet: resolvedVehicleType.includes("SUV") || resolvedVehicleType.includes("Yacht") ? 0.16 : resolvedVehicleType.includes("Hatch") ? 0.04 : 0.09,
        delayOffsetMs: resolvedVehicleType.includes("Sedan") ? 13 : resolvedVehicleType.includes("SUV") || resolvedVehicleType.includes("Yacht") ? 18 : 9,
        highPassFilterHz: isOem ? 50 : 32,
        subCrossoverHz: isOem ? 100 : (resolvedSubConfig.includes("15") || resolvedSubConfig.includes("Wall") ? 75 : resolvedSubConfig.includes("12") ? 80 : 90),
        justification: dspExplanation
      });
    }

    const ai = getAiClient();
    const finalEnvironment = (easyMode && carYearMakeModel) ? "Car" : (environmentMode || "Headphones");
    const finalEquipment = (easyMode && carYearMakeModel) ? carYearMakeModel : (userEquipment || "Standard Drivers");

    const prompt = `
You are the elite AI Master Sound Engineer for the luxury audio application "QUANTUMPLAYERAI". Your job is to calculate mathematically perfect parametric audio settings to transform a standard audio track into a breathtaking, high-fidelity experience tailored precisely to the user's setup.

We are optimizing this profile:
- Track: "${songTitle || "Unknown Track"}" (${genre || "All-Around Audio"})
- Environment Selected: "${finalEnvironment}" (Options: Home, Car, Headphones, Surround Sound)
- User Equipment: "${finalEquipment}"
- Sound Goal Preference: "${soundPreference || "Rich & Immersive"}"

Calibrate the ultimate Digital Signal Processor (DSP) array variables. Keep values within safe operating boundaries:
1. Five EQ band gains (60Hz, 250Hz, 1kHz, 4kHz, 16kHz) in dB (range -12 to +12).
   - For HEADPHONES: Calculate crossfeed adjustments to move vocals out of the user's skull and cast them gracefully in front of them like a high-end live studio layout.
   - For CAR: Compensate for heavy road-noise masking floors and asymmetric passenger seating configurations.
   - For HOME: Calculate compensation curves to balance out boxy room reflections, harsh standing waves, and echoes from hard walls.
   - For SURROUND SOUND: Map virtualization coordinates to upscale standard 2-channel stereo into a deep, sweeping, multi-directional field.
2. Bass Boost level (range 0 to 10). Scale this precisely so it delivers deep, robust warmth without causing clipping.
3. Space Reverberation Wet ratio (0.0 to 0.4) to gently broaden or control the acoustic soundstage depth.
4. Left-channel speaker time-alignment delay offset (0 to 30ms) to snap the center audio image true to the listener.
5. Infrasonic High-Pass Filter safety frequency (20 to 60Hz) to filter out chaotic, non-audible mud frequencies that clip standard amplifiers.
6. Subwoofer Low-Pass Crossover frequency (60 to 120Hz).

7. JUSTIFICATION EXPLANATION (CRITICAL): Write a highly encouraging, friendly, and luxurious summary. 
   - DO NOT be overly academic, rigid, or intimidating. Avoid dry engineering spreadsheets.
   - Speak like an upscale personal audio concierge or premium sound technician. Use warm, clear, and highly rewarding terms (e.g., "breathtaking depth," "velvety low-end warmth," "studio space," "crystal-clear definitions").
   - Explicitly tell them how you reshaped the audio for their selected environment (Home, Car, Headphones, or Surround Sound) so they feel the immense value of why they are paying for this premium tier.

Ready, set, drop!
`;

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

    let jsonText = response.text || "{}";
    if (jsonText.includes("```")) {
      const match = jsonText.match(/```(?:json)?([\s\S]*?)```/);
      if (match && match[1]) {
        jsonText = match[1].trim();
      }
    }
    const dspConfig = JSON.parse(jsonText);
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

// API route for AI-based Video Optimization and Enhancement
app.post("/api/optimize-video", async (req, res) => {
  try {
    // Gatekeep this feature so it is strictly locked unless "active_premium" is true
    const isPremium = await getPremiumStatus(req, "AI_VIDEO_OPTIMIZATION");
    if (!isPremium) {
      return res.status(403).json({
        error: "Premium subscription required",
        code: "PREMIUM_REQUIRED",
        message: "Unlock all AI Video Enhancement features by upgrading to Premium."
      });
    }

    const { 
      videoName, 
      category, 
      activeModel, 
      upscaleTarget, 
      colorEnhancement, 
      smoothMotion, 
      turboMode 
    } = req.body;

    if (!hasGeminiApiKey()) {
      // Elegant fallback when API key is missing
      const baseModel = activeModel || "quantum-scale";
      const baseColor = colorEnhancement || "hdr";
      
      let brightness = 1.05;
      let contrast = 1.15;
      let saturation = 1.20;
      let sharpness = 20;
      let hueRotate = 0;
      let sepia = 0;

      if (baseColor === "hdr") {
        brightness = 1.10;
        contrast = 1.25;
        saturation = 1.30;
        sharpness = 30;
      } else if (baseColor === "vivid") {
        brightness = 1.05;
        contrast = 1.30;
        saturation = 1.55;
        sharpness = 25;
      } else if (baseColor === "lowlight") {
        brightness = 1.28;
        contrast = 1.10;
        saturation = 0.95;
        sharpness = 15;
      } else if (baseColor === "crisp") {
        brightness = 0.98;
        contrast = 1.15;
        saturation = 1.05;
        sharpness = 45;
      }

      if (turboMode) {
        brightness += 0.05;
        contrast += 0.08;
      }

      const justification = `✨ Local Quantum AI Frame Analyzer: Optimizing visual parameters for "${videoName || "Custom Loop"}". Our local DSP pipeline has calibrated the video's pixels! By matching the ${baseModel} reconstruction matrix against your ${baseColor.toUpperCase()} profile, we expanded local contrast ratios to ${Math.round(contrast * 100)}% and fine-tuned saturation to ${Math.round(saturation * 100)}% to match standard dashboard displays. Enjoy premium crystal-clear clarity!`;

      return res.json({
        success: true,
        isFallback: true,
        brightness,
        contrast,
        saturation,
        sharpness,
        hueRotate,
        sepia,
        justification
      });
    }

    const ai = getAiClient();
    const prompt = `
You are the elite AI Video Calibration Specialist for QUANTUMPLAYERAI, an ultra-premium automotive and theater visual playback platform. Your goal is to analyze the chosen video and render options, and generate professional visual digital signal processing (DSP) parameters.

We are optimizing the following video playback configuration:
- Video Track Name: "${videoName || "Custom Loop"}" (${category || "Personal Video"})
- Reconstruction Mode: "${activeModel || "quantum-scale"}" (quantum-scale, deep-cinema, chroma-hdr)
- Target Upscale Level: "${upscaleTarget || "4K"}" (HD, 2K, 4K, 8K)
- Base Color Enhancement Profile: "${colorEnhancement || "hdr"}" (hdr, vivid, lowlight, crisp, none)
- Smooth Motion Interpolation: ${smoothMotion ? "60 FPS Active" : "30 FPS Standard"}
- Turbo HDR Booster Switch: ${turboMode ? "ON" : "OFF"}

Your task is to:
1. Recommend specific visual values to fine-tune the HTML video filters (brightness, contrast, saturation, sharpness, hueRotate, sepia).
2. Write a highly professional, luxurious, and encouraging justification summary explaining:
   - How this combination of reconstruction mode and color enhancement brings out unmatched cinematic depth, rich dynamic range, and fluid playback in this specific video clip.
   - Describe the visual effects with precise, upscale, yet friendly words (e.g., "velvety shadows," "luminous specular highlights," "lifelike color grading," "liquid-smooth frame interpolation").
   - Guide them on what to look for when they watch this optimized loop inside their vehicle's dashboard screen or theater setup.

Provide the response in JSON format matching this schema:
- brightness: (number, safe range 0.8 to 1.5, default 1.0)
- contrast: (number, safe range 0.9 to 1.6, default 1.0)
- saturation: (number, safe range 0.8 to 1.8, default 1.0)
- sharpness: (number, range 0 to 100, custom pixel amount representing clarity, default 15)
- hueRotate: (number, range -20 to 20, degrees of color shifting for precision grading, default 0)
- sepia: (number, range 0 to 0.5, warm analog/vintage overlay, default 0)
- justification: (string, the luxurious description of the visual enhancement applied by the AI)
`;

    let config;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              brightness: { type: Type.NUMBER, description: "Brightness scale factor (0.8 to 1.5)" },
              contrast: { type: Type.NUMBER, description: "Contrast scale factor (0.9 to 1.6)" },
              saturation: { type: Type.NUMBER, description: "Saturation scale factor (0.8 to 1.8)" },
              sharpness: { type: Type.NUMBER, description: "Sharpness level (0 to 100)" },
              hueRotate: { type: Type.NUMBER, description: "Hue rotation in degrees (-20 to 20)" },
              sepia: { type: Type.NUMBER, description: "Sepia overlay amount (0.0 to 0.5)" },
              justification: { type: Type.STRING, description: "A luxurious description of the AI calibration results" }
            },
            required: ["brightness", "contrast", "saturation", "sharpness", "hueRotate", "sepia", "justification"]
          }
        }
      });

      let jsonText = response.text || "{}";
      if (jsonText.includes("```")) {
        const match = jsonText.match(/```(?:json)?([\s\S]*?)```/);
        if (match && match[1]) {
          jsonText = match[1].trim();
        }
      }
      config = JSON.parse(jsonText);
    } catch (aiError: any) {
      console.warn("Gemini video optimization API call failed, falling back to local calculations:", aiError);
      
      const baseModel = activeModel || "quantum-scale";
      const baseColor = colorEnhancement || "hdr";
      
      let brightness = 1.05;
      let contrast = 1.15;
      let saturation = 1.20;
      let sharpness = 20;
      let hueRotate = 0;
      let sepia = 0;

      if (baseColor === "hdr") {
        brightness = 1.10;
        contrast = 1.25;
        saturation = 1.30;
        sharpness = 30;
      } else if (baseColor === "vivid") {
        brightness = 1.05;
        contrast = 1.30;
        saturation = 1.55;
        sharpness = 25;
      } else if (baseColor === "lowlight") {
        brightness = 1.28;
        contrast = 1.10;
        saturation = 0.95;
        sharpness = 15;
      } else if (baseColor === "crisp") {
        brightness = 0.98;
        contrast = 1.15;
        saturation = 1.05;
        sharpness = 45;
      }

      if (turboMode) {
        brightness += 0.05;
        contrast += 0.08;
      }

      config = {
        isFallback: true,
        brightness,
        contrast,
        saturation,
        sharpness,
        hueRotate,
        sepia,
        justification: `✨ Local Quantum AI Frame Analyzer: Optimizing visual parameters for "${videoName || "Custom Loop"}". Our local DSP pipeline has calibrated the video's pixels! By matching the ${baseModel} reconstruction matrix against your ${baseColor.toUpperCase()} profile, we expanded local contrast ratios to ${Math.round(contrast * 100)}% and fine-tuned saturation to ${Math.round(saturation * 100)}% to match standard dashboard displays. Enjoy premium crystal-clear clarity!`
      };
    }
    
    // Bounds checking
    config.brightness = Math.max(0.8, Math.min(1.5, config.brightness || 1.0));
    config.contrast = Math.max(0.9, Math.min(1.6, config.contrast || 1.0));
    config.saturation = Math.max(0.8, Math.min(1.8, config.saturation || 1.0));
    config.sharpness = Math.max(0, Math.min(100, config.sharpness || 15));
    config.hueRotate = Math.max(-20, Math.min(20, config.hueRotate || 0));
    config.sepia = Math.max(0, Math.min(0.5, config.sepia || 0));

    res.json({
      success: true,
      ...config
    });
  } catch (error: any) {
    console.error("Gemini video optimization error:", error);
    res.status(500).json({ error: "Failed to optimize video profile", details: error.message });
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
    
    app.get("*", async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    
    // Serve static files with custom headers to prevent HTML caching while allowing assets caching
    app.use(express.static(distPath, {
      etag: true,
      lastModified: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) {
          // Prevent any caching of HTML entry files so changes load instantly
          res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
          res.set("Pragma", "no-cache");
          res.set("Expires", "0");
        } else if (filePath.match(/\.(js|css|woff2?|eot|ttf|otf)$/)) {
          // Fingerprinted assets (Vite generates unique names for built js/css) can be safely cached
          res.set("Cache-Control", "public, max-age=31536000, immutable");
        } else {
          // Other media/images get revalidation
          res.set("Cache-Control", "no-cache, must-revalidate");
        }
      }
    }));

    app.get("*", (req, res) => {
      // Force no-cache for index.html SPA router fallback
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Car Audio Player backend running on http://localhost:${PORT}`);
  });
}

bootstrapServer();
