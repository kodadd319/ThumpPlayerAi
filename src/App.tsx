import React, { useState, useRef, useEffect, useMemo } from "react"; 
import {   
  Music,   
  Upload,   
  Play,   
  Pause,   
  SkipForward,   
  SkipBack,   
  Sparkles,   
  Cpu,   
  Car,   
  Sliders,   
  Volume2,   
  Trash2,   
  Activity,   
  Info,   
  Shuffle,   
  Repeat,   
  AlertTriangle,   
  VolumeX,   
  PlusCircle,   
  Clock,   
  Dribbble,   
  HelpCircle,   
  Square,   
  FastForward,   
  Rewind,   
  Flame,   
  Bomb,   
  PhoneCall,
  Menu,
  X,
  LogOut
} from "lucide-react"; 
import { Track, VehicleInfo, DspSettings, Preset } from "./types"; 
import jsmediatags from "jsmediatags/dist/jsmediatags.min.js";
import { CarAudioEngine } from "./utils/audioEngine"; 
import { BassKnob } from "./components/BassKnob"; 
import { EqSliders } from "./components/EqSliders"; 
import { DoubleDinPlayer } from "./utils/DoubleDinPlayer"; // Wait, is it "DoubleDinPlayer" or "定位 DoubleDinPlayer"? Oh, let's check the import in user query.
// In the user's query it says: import { DoubleDinPlayer } from "./utils/DoubleDinPlayer";
import { AuthView } from "./components/AuthView"; 
import { MyMusicView } from "./components/MyMusicView"; 
import { UpgradeView } from "./components/UpgradeView";
import { AiEnhancementView } from "./components/AiEnhancementView";
import { VideoView } from "./components/VideoView";
import { motion, AnimatePresence } from "motion/react"; 

// Firebase Integrations Block 
import { auth, db, storage, googleProvider } from "./firebase"; 
import { onAuthStateChanged, signOut, User } from "firebase/auth"; 
import { doc, getDoc, setDoc, collection, addDoc, query, where, onSnapshot, deleteDoc } from "firebase/firestore"; 
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"; 

// Standard Operation Types for Firestore Hardened Audits 
enum OperationType {   
  CREATE = "create",   
  UPDATE = "update",   
  DELETE = "delete",   
  LIST = "list",   
  GET = "get",   
  WRITE = "write" 
}

// Global Secure Firestore Error Handling Wrapper 
function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {   
  const errPayload = {     
    error: error instanceof Error ? error.message : String(error),     
    authInfo: {       
      userId: auth.currentUser?.uid || null,       
      email: auth.currentUser?.email || null,       
      emailVerified: auth.currentUser?.emailVerified || false,       
      isAnonymous: auth.currentUser?.isAnonymous || false,       
      tenantId: auth.currentUser?.tenantId || null,       
      providerInfo: auth.currentUser?.providerData?.map(provider => ({         
        providerId: provider.providerId,         
        email: provider.email,       
      })) || []     
    },     
    operationType,     
    path   };   
  console.error("Firestore Security/Execution Violation Caught:", JSON.stringify(errPayload, null, 2));   
  throw new Error(JSON.stringify(errPayload)); 
}

// Pure JS ID3 parser helper using jsmediatags to extract tags safely client-side
function scanMetadata(file: File): Promise<{ title: string; artist: string; album: string; imageUrl?: string; albumArtUrl?: string | null }> {   
  return new Promise((resolve) => {     
    let defaultArtist = "Unknown Artist";     
    let defaultAlbum = "Unknown Album";     
    let defaultTitle = file ? file.name.replace(/\.[^/.]+$/, "") : "Unknown Track";          
    if (file && defaultTitle.includes(" - ")) {       
      const parts = defaultTitle.split(" - ");       
      defaultArtist = parts[0].trim();       
      defaultTitle = parts[1].trim();     
    }

    try {
      const jst = (jsmediatags as any)?.read ? jsmediatags : (jsmediatags as any)?.default;
      if (!jst || typeof jst.read !== "function") {
        console.warn("jsmediatags library or read function not loaded, utilizing defaults.");
        resolve({ title: defaultTitle, artist: defaultArtist, album: defaultAlbum, albumArtUrl: null });
        return;
      }

      jst.read(file, {
        onSuccess: (tag: any) => {
          try {
            const tags = tag?.tags || {};
            const title = tags.title ? String(tags.title).trim() : defaultTitle;
            const artist = tags.artist ? String(tags.artist).trim() : defaultArtist;
            const album = tags.album ? String(tags.album).trim() : defaultAlbum;
            let imageUrl: string | undefined = undefined;

            if (tags.picture) {
              try {
                const { data, format } = tags.picture;
                let base64String = "";
                const len = data.length;
                for (let i = 0; i < len; i++) {
                  base64String += String.fromCharCode(data[i]);
                }
                imageUrl = `data:${format};base64,${window.btoa(base64String)}`;
              } catch (imgErr) {
                console.error("Failed to parse embedded picture from jsmediatags:", imgErr);
              }
            }
            resolve({ title, artist, album, imageUrl, albumArtUrl: imageUrl || null });
          } catch (successInnerErr) {
            console.error("Error processing successful jsmediatags read:", successInnerErr);
            resolve({ title: defaultTitle, artist: defaultArtist, album: defaultAlbum, albumArtUrl: null });
          }
        },
        onError: (err: any) => {
          console.warn("jsmediatags extraction failed, applying fallbacks:", err);
          resolve({ title: defaultTitle, artist: defaultArtist, album: defaultAlbum, albumArtUrl: null });
        }
      });
    } catch (err) {
      console.error("jsmediatags execution threw error:", err);
      resolve({ title: defaultTitle, artist: defaultArtist, album: defaultAlbum, albumArtUrl: null });
    }
  }); 
}

// Sound presets designed for car audio rigs 
const BUILTIN_PRESETS: Preset[] = [     
  {
    name: "Hip hop",     
    eqBands: [8, 5, -2, 1, 3],     
    bassBoost: 75,     
    reverbWet: 0.08,     
    delayOffsetMs: 8   
  },     
  {
    name: "Rock",     
    eqBands: [3, 4, 1, 4, 3],     
    bassBoost: 45,     
    reverbWet: 0.10,     
    delayOffsetMs: 6   
  },     
  {
    name: "Classical",     
    eqBands: [0, 1, 2, 3, 4],     
    bassBoost: 10,     
    reverbWet: 0.22,     
    delayOffsetMs: 16   
  },
  {
    name: "Pop",
    eqBands: [4, 2, 1, 3, 5],
    bassBoost: 35,
    reverbWet: 0.06,
    delayOffsetMs: 4,
    isPremium: true
  },
  {
    name: "Jazz",
    eqBands: [1, 3, 3, 2, 2],
    bassBoost: 20,
    reverbWet: 0.15,
    delayOffsetMs: 12,
    isPremium: true
  },
  {
    name: "Techo",
    eqBands: [9, 7, -3, 2, 6],
    bassBoost: 80,
    reverbWet: 0.14,
    delayOffsetMs: 8,
    isPremium: true
  },
  {
    name: "Movie",
    eqBands: [7, 3, 4, 2, 5],
    bassBoost: 55,
    reverbWet: 0.25,
    delayOffsetMs: 22,
    isPremium: true
  }
]; 

export default function App() {   
  const [currentView, setCurrentView] = useState<"landing" | "auth" | "player" | "mymusic" | "privacy" | "agreement" | "upgrade" | "ai_enhancement" | "video">("landing");   
  const [subscriptionTier, setSubscriptionTier] = useState<"free" | "paid">(
    () => (localStorage.getItem("thumplayer_sub_tier") as "free" | "paid") || "free"
  );
  const [globalPremiumPrompt, setGlobalPremiumPrompt] = useState<string>("");
  const [playlist, setPlaylist] = useState<Track[]>([]);   
  const [playbackQueue, setPlaybackQueue] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(-1);   
  const [isPlaying, setIsPlaying] = useState<boolean>(false);   
  const [songProgress, setSongProgress] = useState<number>(0);   
  const [songDuration, setSongDuration] = useState<number>(0);   
  const [volume, setVolume] = useState<number>(0.85);   
  const [isMuted, setIsMuted] = useState<boolean>(false);   
  const [repeatMode, setRepeatMode] = useState<"none" | "one" | "all">("all");   
  const [shuffleMode, setShuffleMode] = useState<boolean>(false);   
  const [playlistViewMode, setPlaylistViewMode] = useState<"all" | "artist" | "album">("all");   
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});   
  const [playerTab, setPlayerTab] = useState<"workbench" | "mymusic">("workbench");   
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isMinimizedClosed, setIsMinimizedClosed] = useState<boolean>(false);
  const [isAppBackgrounded, setIsAppBackgrounded] = useState<boolean>(
    typeof document !== "undefined" ? (document.visibilityState === "hidden" || !document.hasFocus()) : false
  );
  const toggleMenu = () => {
    setIsOpen((prev) => !prev);
  };

  const tracksByArtist = useMemo(() => {     
    const groups: Record<string, Track[]> = {};     
    playlist.forEach((track) => {       
      const artist = track.artist || "Unknown Artist";       
      if (!groups[artist]) groups[artist] = [];       
      groups[artist].push(track);     
    });     
    return groups;   
  }, [playlist]);   

  const tracksByAlbum = useMemo(() => {     
    const groups: Record<string, Track[]> = {};     
    playlist.forEach((track) => {       
      const album = track.album || "Unknown Album";       
      if (!groups[album]) groups[album] = [];       
      groups[album].push(track);     
    });     
    return groups;   
  }, [playlist]);   

  const audioRef = useRef<HTMLAudioElement | null>(null);   
  const engineRef = useRef<CarAudioEngine | null>(null);   
  const syntheticIntervalRef = useRef<any>(null);
  const [engineReady, setEngineReady] = useState(false);   
  const [currentUser, setCurrentUser] = useState<User | null>(null);   
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);   
  const [firestoreTracks, setFirestoreTracks] = useState<Track[]>([]);   
  const [isUploading, setIsUploading] = useState<boolean>(false);   
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);   
  const [uploadError, setUploadError] = useState<string>("");   
  const [uploadSuccess, setUploadSuccess] = useState<string>("");   
  const [accentTheme, setAccentTheme] = useState<"cyan" | "cherry" | "chrome">("cyan");   
  const [headunitTime, setHeadunitTime] = useState("13:30");   
  const [isPhoneScreenActive, setIsPhoneScreenActive] = useState(false);   
  const [dialedNumber, setDialedNumber] = useState("");   
  const [callStatus, setCallStatus] = useState("");   
  const [loadedTrackId, setLoadedTrackId] = useState<string | null>(null);
  const lastSavedSettingsRef = useRef<any>(null);

  useEffect(() => {     
    const updateTime = () => {       
      const now = new Date();       
      let hours = now.getHours();       
      const minutes = String(now.getMinutes()).padStart(2, "0");       
      const ampm = hours >= 12 ? "PM" : "AM";       
      hours = hours % 12;       
      hours = hours ? hours : 12;       
      setHeadunitTime(`${hours}:${minutes} ${ampm}`);     
    };     
    updateTime();     
    const timer = setInterval(updateTime, 1000);     
    return () => clearInterval(timer);   
  }, []);

  useEffect(() => {     
    setAuthLoading(true);     
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {       
      if (user) {         
        console.log("Firebase Authenticated Session Established:", user.uid);         
        setCurrentUser(user);         
        setIsLoggedIn(true);
        setAuthLoading(false);         
        const userDocRef = doc(db, "users", user.uid);         
        const unsubscribeSettings = onSnapshot(userDocRef, (docSnap) => {           
          if (docSnap.exists()) {             
            const data = docSnap.data();             
            lastSavedSettingsRef.current = data;
            if (data.accentTheme) {               
               setAccentTheme(data.accentTheme);             
            }           
            if (typeof data.volume === "number") {
              setVolume(data.volume);
              if (audioRef.current) audioRef.current.volume = data.volume;
            }
            if (typeof data.isMuted === "boolean") {
              setIsMuted(data.isMuted);
              if (audioRef.current) audioRef.current.muted = data.isMuted;
            }
            if (data.repeatMode) {
              setRepeatMode(data.repeatMode as "none" | "one" | "all");
            }
            if (typeof data.shuffleMode === "boolean") {
              setShuffleMode(data.shuffleMode);
            }
            if (data.subscriptionTier) {
              setSubscriptionTier((user.email === "jkoehler319@gmail.com" ? "paid" : data.subscriptionTier) as "free" | "paid");
            } else if (user.email === "jkoehler319@gmail.com") {
              setSubscriptionTier("paid");
            }
            if (data.currentTrackId !== undefined) {
              setLoadedTrackId(data.currentTrackId);
            }
            if (data.selectedPresetName) {
              setSelectedPresetName(data.selectedPresetName);
            }
            if (data.customEqBands !== undefined) {
              setCustomEqBands(data.customEqBands);
            }
            if (typeof data.isMaxBass === "boolean") {
              setIsMaxBass(data.isMaxBass);
            }
            if (data.vehicleInfo) {
              setVehicleInfo(prev => {
                const merged = { ...prev, ...data.vehicleInfo };
                if (JSON.stringify(prev) === JSON.stringify(merged)) {
                  return prev;
                }
                return merged;
              });
            }
            if (data.dspSettings) {
              setDspSettings(prev => {
                const merged = { ...prev, ...data.dspSettings };
                if (JSON.stringify(prev) === JSON.stringify(merged)) {
                  return prev;
                }
                return merged;
              });
            }
          } else {             
            const initialData = {               
              uid: user.uid,               
              accentTheme: "cyan" as const,               
              lastLogin: new Date().toISOString(),
              volume: 0.85,
              isMuted: false,
              repeatMode: "all" as const,
              shuffleMode: false,
              subscriptionTier: (user.email === "jkoehler319@gmail.com" ? "paid" : "free") as "free" | "paid",
              currentTrackId: null,
              selectedPresetName: "Hip hop",
              customEqBands: null,
              isMaxBass: false,
              vehicleInfo: {
                vehicleType: "Sedan",
                subwooferConfig: "Single 12\" Sub",
                soundPreference: "SQL (Sound Quality Loud)"
              },
              dspSettings: {
                eqBands: [4, 1, 0, 2, 3],
                bassBoost: 50.0,
                reverbWet: 0.08,
                delayOffsetMs: 12,
                highPassFilterHz: 30,
                subCrossoverHz: 80,
                justification: "ElitePlayer setup loaded. Select your vehicle cabin size, your trunk speaker box gear, and slam that AI Sound Optimization button! We'll formulate a premium street-competition DSP profile tailored specifically for your ride."
              }
            };
            lastSavedSettingsRef.current = initialData;
            setSubscriptionTier(user.email === "jkoehler319@gmail.com" ? "paid" : "free");
            setDoc(userDocRef, initialData, { merge: true })
              .catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`));           
          }         
        }, (err) => {           
          handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);         
        });         
        const tracksQuery = query(collection(db, "tracks"), where("uid", "==", user.uid));         
        const unsubscribeTracks = onSnapshot(tracksQuery, (querySnapshot) => {           
          const songs: Track[] = [];           
          querySnapshot.forEach((docSnap) => {             
            const data = docSnap.data();             
            songs.push({               
              id: docSnap.id,               
              name: data.name || "Cloud Track",               
              artist: data.artist || "Anonymous Streamer",               
              album: data.album || "Cloud Catalog Single",               
              duration: data.duration || 180,               
              genre: data.genre || "Bass Head Trap",               
              url: data.url,
              imageUrl: data.imageUrl || "",
              albumArtUrl: data.albumArtUrl || data.imageUrl || null
            });           
          });           
          setFirestoreTracks(songs);         
        }, (err) => {           
          handleFirestoreError(err, OperationType.LIST, "tracks");         
        });         
        return () => {           
          unsubscribeSettings();           
          unsubscribeTracks();         
        };       
      } else {         
        setCurrentUser(null);         
        setIsLoggedIn(false);
        setFirestoreTracks([]);         
        setAuthLoading(false);       
        lastSavedSettingsRef.current = null;
        setLoadedTrackId(null);
        // Reset local configurations on log out
        setAccentTheme("cyan");
        setVolume(0.85);
        if (audioRef.current) audioRef.current.volume = 0.85;
        setIsMuted(false);
        if (audioRef.current) audioRef.current.muted = false;
        setRepeatMode("all");
        setShuffleMode(false);
        setSubscriptionTier("free");
        setCurrentTrackIndex(-1);
        setSelectedPresetName("Hip hop");
        setIsMaxBass(false);
        setVehicleInfo({
          vehicleType: "Sedan",
          subwooferConfig: "Single 12\" Sub",
          soundPreference: "SQL (Sound Quality Loud)"
        });
        setDspSettings({
          eqBands: [4, 1, 0, 2, 3],
          bassBoost: 50.0,
          reverbWet: 0.08,
          delayOffsetMs: 12,
          highPassFilterHz: 30,
          subCrossoverHz: 80,
          justification: "ElitePlayer setup loaded. Select your vehicle cabin size, your trunk speaker box gear, and slam that AI Sound Optimization button! We'll formulate a premium street-competition DSP profile tailored specifically for your ride."
        });
      }     
    });     
    return () => unsubscribeAuth();   
  }, []);

  useEffect(() => {     
    if (!authLoading) {
      if (!isLoggedIn) {       
        const protectedViews = ["player", "mymusic", "upgrade", "ai_enhancement", "video"];
        if (protectedViews.includes(currentView)) {
          setCurrentView("auth");
        }
      } else {
        if (currentView === "auth") {
          setCurrentView("player");
        }
      }
    }   
  }, [isLoggedIn, currentView, authLoading]);   

  const handleAccentThemeChange = async (theme: "cyan" | "cherry" | "chrome") => {     
    setAccentTheme(theme);     
    if (currentUser) {       
      try {         
        const userDocRef = doc(db, "users", currentUser.uid);         
        await setDoc(userDocRef, {           
          accentTheme: theme,           
          updatedAt: new Date().toISOString()         
        }, { merge: true });         
        console.log("Persistent styling preference written to Firestore:", theme);       
      } catch (err) {         
        handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}`);       
      }     
    }   
  };   

  useEffect(() => {     
    const sampleTracks: Track[] = [       
      {         
        id: "sample-40hz",         
        name: "40Hz Subwoofer Competition Tone",         
        artist: "ElitePlayer DSP sweeps",         
        album: "DSP Lab sweeps",         
        duration: 90,         
        genre: "SPL Test Sweep",         
        file: new File([], "40hz_test_sweep.mp3"),
        imageUrl: "https://images.unsplash.com/photo-1545454675-3531b543be5d?w=500&auto=format&fit=crop&q=80",
        albumArtUrl: "https://images.unsplash.com/photo-1545454675-3531b543be5d?w=500&auto=format&fit=crop&q=80"
      },       
      {         
        id: "sample-heavy",         
        name: "Trap Heavy Bassline Drop (Synthesized)",         
        artist: "ElitePlayer Beats",         
        album: "Thump Synths Vol 1",         
        duration: 120,         
        genre: "Booming Trap",         
        file: new File([], "trap_bassline_drop.mp3"),
        imageUrl: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=80",
        albumArtUrl: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=80"
      },       
      {         
        id: "sample-sweep",         
        name: "25Hz - 120Hz Fast Sub Sweep",         
        artist: "DSP Cabin Acoustics",         
        album: "Cabin Acoustics Calibrations",         
        duration: 45,         
        genre: "Frequency Sweep",         
        file: new File([], "sub_sweep_acoustic.mp3"),
        imageUrl: "https://images.unsplash.com/photo-1516280440614-37939bbacd6a?w=500&auto=format&fit=crop&q=80",
        albumArtUrl: "https://images.unsplash.com/photo-1516280440614-37939bbacd6a?w=500&auto=format&fit=crop&q=80"
      }     
    ];     
    setPlaylist((prevPlaylist) => {
      const localTracks = prevPlaylist.filter(track => track.id.startsWith("local-"));
      return [...sampleTracks, ...localTracks, ...firestoreTracks];
    });
  }, [firestoreTracks]);   

  useEffect(() => {
    if (currentTrackIndex === -1 && playlist.length > 0) {
      setCurrentTrackIndex(0);
    }
  }, [playlist, currentTrackIndex]);   

  const appendDialDigit = (digit: string) => {     
    if (dialedNumber.length < 15) {       
      setDialedNumber((prev) => prev + digit);     
    }   
  };   

  const clearDialedDigits = () => {     
    setDialedNumber("");     
    setCallStatus("");   
  };   

  const triggerPhoneCall = () => {     
    if (!dialedNumber) {       
      setCallStatus("ENTER DIGITS FIRST_");       
      return;     
    }     
    if (callStatus) {       
      setCallStatus("");       
      return;     
    }          
    setCallStatus("DIALING SPECIALIST STATION...");     
    setTimeout(() => {       
      setCallStatus("LINE CONNECTED: 'Yo! This is Alpine Support. You want more trunk boom and hairtrick thump? Turn on that ATOMIC BLAST! Keep the street slam loud!'");     
    }, 2000);   
  };   

  const [syntheticOsc, setSyntheticOsc] = useState<OscillatorNode | null>(null);   
  const [syntheticGain, setSyntheticGain] = useState<GainNode | null>(null);   
  const [currentSyntheticLabel, setCurrentSyntheticLabel] = useState<string>("");   

  const [vehicleInfo, setVehicleInfo] = useState<VehicleInfo>({     
    vehicleType: "Headphones",     
    subwooferConfig: "Standard",     
    soundPreference: "SQL (Sound Quality Loud)"   
  });   

  const [dspSettings, setDspSettings] = useState<DspSettings>({     
    eqBands: [4, 1, 0, 2, 3],     
    bassBoost: 50.0,     
    reverbWet: 0.08,     
    delayOffsetMs: 12,     
    highPassFilterHz: 30,     
    subCrossoverHz: 80,     
    justification: "ElitePlayer setup loaded. Select your vehicle cabin size, your trunk speaker box gear, and slam that AI Sound Optimization button! We'll formulate a premium street-competition DSP profile tailored specifically for your ride."   
  });   

  const [selectedPresetName, setSelectedPresetName] = useState<string>("Hip hop");   
  const [customEqBands, setCustomEqBands] = useState<number[] | null>(() => {
    try {
      const saved = localStorage.getItem("thumplayer_custom_eq_bands");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isMaxBass, setIsMaxBass] = useState<boolean>(false);   
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);   
  const [showAtomicExplosion, setShowAtomicExplosion] = useState<boolean>(false);   

  const handleSubscriptionTierChange = (tier: "free" | "paid") => {
    const forcedTier = currentUser?.email === "jkoehler319@gmail.com" ? "paid" : tier;
    setSubscriptionTier(forcedTier);
    localStorage.setItem("thumplayer_sub_tier", forcedTier);
    if (forcedTier === "paid") {
      setGlobalPremiumPrompt(""); 
      console.log("Premium plan activated - Unlocked custom presets, unlimited track uploads, and AI high-fidelity filter algorithms!");
    } else {
      console.log("Restoring Free tier limitations - checking and relocking specific features.");
      setGlobalPremiumPrompt("");
      // Reset selected preset if it was a premium one to avoid unauthorized premium state leakage
      if (BUILTIN_PRESETS.some(p => p.name === selectedPresetName && p.isPremium)) {
        const firstFreePreset = BUILTIN_PRESETS.find(p => !p.isPremium);
        if (firstFreePreset) {
          applyAudioPreset(firstFreePreset);
        }
      }
    }
  };

  const ensureEngine = () => {     
    if (!audioRef.current) return;     
    if (!engineRef.current) {       
      const e = new CarAudioEngine(audioRef.current);       
      e.init();       
      engineRef.current = e;       
      setEngineReady(true);              
      e.applyDspSettings(dspSettings);       
      e.audioElement.volume = isMuted ? 0 : volume;     
    } else {       
      engineRef.current.resume();     
    }   
  };   

  const currentTrack = useMemo(() => {     
    if (currentTrackIndex >= 0 && currentTrackIndex < playlist.length) {       
      return playlist[currentTrackIndex];     
    }     
    return null;   
  }, [playlist, currentTrackIndex]);   

  useEffect(() => {     
    const audio = audioRef.current;     
    if (!audio) return;     
    const onTimeUpdate = () => {       
      setSongProgress(audio.currentTime);     
    };     
    const onLoadedMetadata = () => {       
      const dur = audio.duration || 120;
      setSongDuration(dur);     
      if (currentTrackIndex >= 0 && currentTrackIndex < playlist.length) {
        if (!playlist[currentTrackIndex].duration) {
          setPlaylist(prev => {
            const nextList = [...prev];
            if (nextList[currentTrackIndex]) {
              nextList[currentTrackIndex] = {
                ...nextList[currentTrackIndex],
                duration: Math.round(dur)
              };
            }
            return nextList;
          });
        }
      }
    };     
    const onEnded = () => {       
      handleNextTrack();     
    };     
    const onPause = () => {
      setIsPlaying(false);
    };
    const onPlay = () => {
      setIsPlaying(true);
    };
    audio.addEventListener("timeupdate", onTimeUpdate);     
    audio.addEventListener("loadedmetadata", onLoadedMetadata);     
    audio.addEventListener("ended", onEnded);     
    audio.addEventListener("pause", onPause);
    audio.addEventListener("play", onPlay);
    return () => {       
      audio.removeEventListener("timeupdate", onTimeUpdate);       
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);       
      audio.removeEventListener("ended", onEnded);     
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("play", onPlay);
    };   
  }, [playlist, currentTrackIndex, repeatMode, shuffleMode]);   

  // Synchronize MediaSession metadata & action handlers for background play & lockscreen support
  useEffect(() => {
    if ("mediaSession" in navigator && currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.name,
        artist: currentTrack.artist || "Unknown Artist",
        album: currentTrack.album || "Elite Player AI",
        artwork: [
          { src: "https://images.unsplash.com/photo-1614680376593-902f74fa0d41?w=512", sizes: "512x512", type: "image/jpeg" }
        ]
      });

      navigator.mediaSession.setActionHandler("play", () => {
        if (audioRef.current) {
          audioRef.current.play().then(() => setIsPlaying(true)).catch(console.warn);
        }
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        if (audioRef.current) {
          audioRef.current.pause();
          setIsPlaying(false);
        }
      });
      navigator.mediaSession.setActionHandler("previoustrack", () => {
        handlePrevTrack();
      });
      navigator.mediaSession.setActionHandler("nexttrack", () => {
        handleNextTrack();
      });
    }
  }, [currentTrack]);

  // Automatic routing when returning to app from background
  useEffect(() => {
    const handleReturnToApp = () => {
      // If there's an active track, we are not viewing the player page, and it's not dismissed
      // Do not automatically redirect if the user is on the mymusic or video view (such as after file uploads)
      if (currentTrack && currentView !== "player" && currentView !== "mymusic" && currentView !== "video" && !isMinimizedClosed) {
        setCurrentView("player");
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        handleReturnToApp();
      }
    };

    const handleWindowFocus = () => {
      handleReturnToApp();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [currentTrack, currentView, isMinimizedClosed]);

  // Synchronize app background status (navigating out of the app / blur / focus / call overlays)
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsAppBackgrounded(document.visibilityState === "hidden" || !document.hasFocus());
    };
    const handleBlur = () => {
      setIsAppBackgrounded(true);
    };
    const handleFocus = () => {
      setIsAppBackgrounded(false);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  // Auto-reset dismissed state when entering full player view or starting playback
  useEffect(() => {
    if (currentView === "player") {
      setIsMinimizedClosed(false);
    }
  }, [currentView]);

  useEffect(() => {
    if (isPlaying) {
      setIsMinimizedClosed(false);
    }
  }, [isPlaying]);   

  useEffect(() => {     
    if (audioRef.current) {       
      audioRef.current.volume = isMuted ? 0 : volume;     
    }   
  }, [volume, isMuted]);   const handleAudioFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentUser) {
      setUploadError("Please check authentication session or select a valid audio file.");
      return;
    }

    // Check Free Tier track upload restrictions safely
    const currentUploadsCount = (playlist || []).filter(t => t && t.id && !t.id.startsWith("sample-")).length;
    if ((subscriptionTier || "free") !== "paid" && (currentUploadsCount + 1) > 10) {
      setGlobalPremiumPrompt(`Free Tier is limited to a maximum of 10 track uploads. You currently have ${currentUploadsCount} uploads. Please upgrade to enjoy unlimited high-fidelity track uploads!`);
      setCurrentView("upgrade");
      event.target.value = ""; 
      return;
    }

    // 1. Initial State Fire-up
    setIsUploading(true);
    setUploadProgress(0);
    setUploadError("");
    setUploadSuccess("");

    try {
      // 2. Scan Audio Metadata on the Client Layer
      const metadata = await scanMetadata(file);

      // 3. Formulate Unique Cloud Path inside Storage Bucket
      const timestamp = Date.now();
      const storagePath = `tracks/${currentUser.uid}/${timestamp}_${file.name}`;
      const storageRef = ref(storage, storagePath);

      // 4. Fire the Resumable Streaming Connection Upload Link with correct audio/mpeg content-type metadata
      const uploadTask = uploadBytesResumable(storageRef, file, { contentType: "audio/mpeg" });

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          // Calculate current chunk completion progress percentage
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(Math.round(progress));
          console.log(`Uploading track payload to Firebase: ${Math.round(progress)}% complete`);
        },
        (error) => {
          // Catch and process upload failures cleanly
          console.error("Firebase Storage Upload Pipeline Aborted:", error);
          setUploadError(`Storage Transfer Failed: ${error.message}`);
          setIsUploading(false);
          setUploadProgress(null);
        },
        async () => {
          try {
            // 5. Fetch Secure Live CDN URL from Storage Bucket
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);

            // Determine genre based on filename
            let genre = "Bass Accent";
            const fileLower = file.name.toLowerCase();
            if (fileLower.includes("rap") || fileLower.includes("hip") || fileLower.includes("beat")) {
              genre = "Hip Hop / Rap";
            } else if (fileLower.includes("rock") || fileLower.includes("metal") || fileLower.includes("guitar")) {
              genre = "Rock / Metal";
            } else if (fileLower.includes("electro") || fileLower.includes("edm") || fileLower.includes("house") || fileLower.includes("dance")) {
              genre = "EDM / Electronic";
            } else if (fileLower.includes("pop") || fileLower.includes("rnb") || fileLower.includes("vocal")) {
              genre = "Pop Vocal";
            }

            // 6. Save File Pointers to Firestore Document Database
            const trackDocData = {
              uid: currentUser.uid,
              name: metadata.title || file.name.replace(/\.[^/.]+$/, ""),
              artist: metadata.artist || "Anonymous Streamer",
              album: metadata.album || "Cloud Catalog Single",
              genre: genre,
              duration: 180, // Default fallback metadata parameter
              url: downloadUrl,
              imageUrl: metadata.imageUrl || "https://images.unsplash.com/photo-1545454675-3531b543be5d?w=500&auto=format&fit=crop&q=80",
              albumArtUrl: metadata.albumArtUrl || null,
              createdAt: new Date().toISOString()
            };

            const docRef = await addDoc(collection(db, "tracks"), trackDocData);

            // 7. Success Finalization Flags reset
            setUploadSuccess(`"${trackDocData.name}" synced to audio cloud locker successfully!`);
            setIsUploading(false);
            setUploadProgress(null);
            setLoadedTrackId(docRef.id);
            setIsPlaying(false);
            stopSyntheticOsc();
            setCurrentView("mymusic");
            
            // Auto wipe notification notice after 4 seconds
            setTimeout(() => setUploadSuccess(""), 4000);
          } catch (dbErr: any) {
            console.error("Failed to catalog track layout document inside Firestore:", dbErr);
            setUploadError("Audio saved to storage, but database index linking failed.");
            setIsUploading(false);
            setUploadProgress(null);
          }
        }
      );
    } catch (err: any) {
      console.error("Critical tracking crash during file compilation process:", err);
      setUploadError("Failed to initialize storage pipe infrastructure.");
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const handleCloudFileUpload = handleAudioFileUpload;   
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {     
    if (!e.target.files || !currentUser) {
      setUploadError("Please check authentication session or select valid audio files.");
      return;
    }     
    const files = Array.from(e.target.files) as File[];          
    
    // Check Free Tier track upload restrictions safely
    const currentUploadsCount = (playlist || []).filter(t => t && t.id && !t.id.startsWith("sample-")).length;
    if ((subscriptionTier || "free") !== "paid" && (currentUploadsCount + files.length) > 10) {
      setGlobalPremiumPrompt(`Free Tier is limited to a maximum of 10 track uploads. You currently have ${currentUploadsCount} uploads. Please upgrade to enjoy unlimited high-fidelity track uploads!`);
      setCurrentView("upgrade");
      e.target.value = ""; 
      return;
    }
 
    setIsUploading(true);
    setUploadProgress(0);
    setUploadError("");
    setUploadSuccess("");

    try {
      let successCount = 0;
      let firstUploadedTrackId: string | null = null;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`Uploading file ${i + 1}/${files.length}: ${file.name}`);
        
        // Scan Audio Metadata on the Client Layer
        const metadata = await scanMetadata(file);

        // Formulate Unique Cloud Path inside Storage Bucket
        const timestamp = Date.now();
        const storagePath = `tracks/${currentUser.uid}/${timestamp}_${file.name}`;
        const storageRef = ref(storage, storagePath);

        // Fire the Resumable Streaming Connection Upload Link with correct audio/mpeg content-type metadata
        const uploadTask = uploadBytesResumable(storageRef, file, { contentType: "audio/mpeg" });

        await new Promise<void>((resolveUpload, rejectUpload) => {
          uploadTask.on(
            "state_changed",
            (snapshot) => {
              // Calculate current chunk completion progress percentage
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              // Set progress relative to overall files
              const totalProgress = Math.round(((i / files.length) * 100) + (progress / files.length));
              setUploadProgress(totalProgress);
              console.log(`Uploading file ${i + 1}/${files.length} to Firebase: ${Math.round(progress)}% complete`);
            },
            (error) => {
              console.error("Firebase Storage Upload Pipeline Aborted:", error);
              rejectUpload(error);
            },
            async () => {
              try {
                // Fetch Secure Live CDN URL from Storage Bucket
                const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);

                // Determine genre based on filename
                let genre = "Bass Accent";
                const fileLower = file.name.toLowerCase();
                if (fileLower.includes("rap") || fileLower.includes("hip") || fileLower.includes("beat")) {
                  genre = "Hip Hop / Rap";
                } else if (fileLower.includes("rock") || fileLower.includes("metal") || fileLower.includes("guitar")) {
                  genre = "Rock / Metal";
                } else if (fileLower.includes("electro") || fileLower.includes("edm") || fileLower.includes("house") || fileLower.includes("dance")) {
                  genre = "EDM / Electronic";
                } else if (fileLower.includes("pop") || fileLower.includes("rnb") || fileLower.includes("vocal")) {
                  genre = "Pop Vocal";
                }

                // Save File Pointers to Firestore Document Database
                const trackDocData = {
                  uid: currentUser.uid,
                  name: metadata.title || file.name.replace(/\.[^/.]+$/, ""),
                  artist: metadata.artist || "Anonymous Streamer",
                  album: metadata.album || "Cloud Catalog Single",
                  genre: genre,
                  duration: 180, // Default fallback metadata parameter
                  url: downloadUrl,
                  imageUrl: metadata.imageUrl || "https://images.unsplash.com/photo-1545454675-3531b543be5d?w=500&auto=format&fit=crop&q=80",
                  albumArtUrl: metadata.albumArtUrl || null,
                  createdAt: new Date().toISOString()
                };

                const docRef = await addDoc(collection(db, "tracks"), trackDocData);
                if (!firstUploadedTrackId) {
                  firstUploadedTrackId = docRef.id;
                }
                successCount++;
                resolveUpload();
              } catch (dbErr: any) {
                console.error("Failed to catalog track layout document inside Firestore:", dbErr);
                rejectUpload(dbErr);
              }
            }
          );
        });
      }

      setUploadSuccess(`Successfully uploaded ${successCount} track(s) to your cloud library!`);
      setIsUploading(false);
      setUploadProgress(null);
      setIsPlaying(false);
      stopSyntheticOsc();
      setCurrentView("mymusic");
      if (firstUploadedTrackId) {
        setLoadedTrackId(firstUploadedTrackId);
      }

      // Auto wipe notification notice after 4 seconds
      setTimeout(() => setUploadSuccess(""), 4000);
      
    } catch (err: any) {
      console.error("Critical tracking crash during file compilation process:", err);
      setUploadError(`Failed to initialize storage pipe infrastructure: ${err.message || err}`);
      setIsUploading(false);
      setUploadProgress(null);
    }
  };   

  const loadTrackSource = (audio: HTMLAudioElement, track: Track) => {     
    if (audio.src && audio.src.startsWith("blob:")) {       
      try {         
        URL.revokeObjectURL(audio.src);       
      } catch (err) {         
        console.warn("Failed to revoke blob URL:", err);       
      }     
    }     
    if (track.url) {       
      audio.crossOrigin = "anonymous";
      audio.src = track.url;     
    } else if (track.file) {       
      audio.removeAttribute("crossorigin");
      audio.src = URL.createObjectURL(track.file);     
    }   
    if (track.duration) {
      setSongDuration(track.duration);
    } else {
      setSongDuration(0);
    }
  };   

  // Synchronize player with the loaded track index when database setting is loaded
  useEffect(() => {
    if (loadedTrackId && playlist.length > 0) {
      const idx = playlist.findIndex(t => t.id === loadedTrackId);
      if (idx !== -1 && idx !== currentTrackIndex) {
        setCurrentTrackIndex(idx);
        const audio = audioRef.current;
        const track = playlist[idx];
        if (audio && track) {
          if (!track.id.startsWith("sample-")) {
            loadTrackSource(audio, track);
          } else {
            setCurrentSyntheticLabel(track.name);
          }
        }
      }
    }
  }, [playlist, loadedTrackId]);

  // Reactive automatic settings syncing to the user's Firestore account
  useEffect(() => {
    if (!isLoggedIn || !currentUser) return;
    
    const activeTrackId = currentTrackIndex >= 0 && playlist[currentTrackIndex] ? playlist[currentTrackIndex].id : null;
    
    const currentSettings = {
      accentTheme,
      volume,
      isMuted,
      repeatMode,
      shuffleMode,
      subscriptionTier: currentUser?.email === "jkoehler319@gmail.com" ? "paid" : subscriptionTier,
      currentTrackId: activeTrackId,
      selectedPresetName,
      isMaxBass,
      vehicleInfo,
      dspSettings,
      customEqBands
    };
    
    const prev = lastSavedSettingsRef.current;
    if (!prev) {
      // Haven't loaded existing remote settings yet - ignore to prevent overwriting
      return;
    }
    
    // Deep equality comparison
    let hasChanged = false;
    const diffs: string[] = [];
    if (prev.accentTheme !== currentSettings.accentTheme) { hasChanged = true; diffs.push(`accentTheme: ${prev.accentTheme} -> ${currentSettings.accentTheme}`); }
    if (prev.volume !== currentSettings.volume) { hasChanged = true; diffs.push(`volume: ${prev.volume} -> ${currentSettings.volume}`); }
    if (prev.isMuted !== currentSettings.isMuted) { hasChanged = true; diffs.push(`isMuted: ${prev.isMuted} -> ${currentSettings.isMuted}`); }
    if (prev.repeatMode !== currentSettings.repeatMode) { hasChanged = true; diffs.push(`repeatMode: ${prev.repeatMode} -> ${currentSettings.repeatMode}`); }
    if (prev.shuffleMode !== currentSettings.shuffleMode) { hasChanged = true; diffs.push(`shuffleMode: ${prev.shuffleMode} -> ${currentSettings.shuffleMode}`); }
    if (prev.subscriptionTier !== currentSettings.subscriptionTier) { hasChanged = true; diffs.push(`subscriptionTier: ${prev.subscriptionTier} -> ${currentSettings.subscriptionTier}`); }
    if (prev.currentTrackId !== currentSettings.currentTrackId) { hasChanged = true; diffs.push(`currentTrackId: ${prev.currentTrackId} -> ${currentSettings.currentTrackId}`); }
    if (prev.selectedPresetName !== currentSettings.selectedPresetName) { hasChanged = true; diffs.push(`selectedPresetName: ${prev.selectedPresetName} -> ${currentSettings.selectedPresetName}`); }
    if (JSON.stringify(prev.customEqBands) !== JSON.stringify(currentSettings.customEqBands)) { hasChanged = true; diffs.push(`customEqBands: ${JSON.stringify(prev.customEqBands)} -> ${JSON.stringify(currentSettings.customEqBands)}`); }
    if (prev.isMaxBass !== currentSettings.isMaxBass) { hasChanged = true; diffs.push(`isMaxBass: ${prev.isMaxBass} -> ${currentSettings.isMaxBass}`); }
    if (JSON.stringify(prev.vehicleInfo) !== JSON.stringify(currentSettings.vehicleInfo)) { 
      hasChanged = true; 
      diffs.push(`vehicleInfo: ${JSON.stringify(prev.vehicleInfo)} -> ${JSON.stringify(currentSettings.vehicleInfo)}`); 
    }
    if (JSON.stringify(prev.dspSettings) !== JSON.stringify(currentSettings.dspSettings)) { 
      hasChanged = true; 
      diffs.push(`dspSettings: ${JSON.stringify(prev.dspSettings)} -> ${JSON.stringify(currentSettings.dspSettings)}`); 
    }
    
    if (hasChanged) {
      console.log("Detecting local settings drift from Firestore. Diffs:", diffs);
      // Optimistically update our comparison ref to avoid parallel execution race conditions
      lastSavedSettingsRef.current = {
        ...prev,
        ...currentSettings
      };
      
      const userDocRef = doc(db, "users", currentUser.uid);
      setDoc(userDocRef, {
        ...currentSettings,
        uid: currentUser.uid,
        updatedAt: new Date().toISOString()
      }, { merge: true })
        .then(() => {
          console.log("Automatically synchronized updated configurations to database.");
        })
        .catch((err) => {
          console.error("Auto configuration sync error:", err);
          handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}`);
        });
    }
  }, [
    isLoggedIn,
    currentUser,
    accentTheme,
    volume,
    isMuted,
    repeatMode,
    shuffleMode,
    subscriptionTier,
    currentTrackIndex,
    playlist,
    selectedPresetName,
    customEqBands,
    isMaxBass,
    vehicleInfo,
    dspSettings
  ]);

  const handlePlayPause = () => {     
    ensureEngine();          
    if (currentTrack?.id.startsWith("sample-")) {       
      if (isPlaying) {
        stopSyntheticOsc();
        setIsPlaying(false);
      } else {
        handlePlaySynthetic(currentTrack);       
      }
      return;     
    }     
    if (!audioRef.current) return;     
    if (isPlaying) {       
      audioRef.current.pause();       
      setIsPlaying(false);     
    } else {       
      audioRef.current.play()         
        .then(() => setIsPlaying(true))         
        .catch(err => {           
          console.warn("Audio play blocked by browser sandbox gesture restriction. Retrying manually.", err);         
        });     
    }   
  };   

  const handleStop = () => {     
    stopSyntheticOsc();     
    setIsPlaying(false);     
    setSongProgress(0);     
    if (audioRef.current) {       
      audioRef.current.pause();       
      audioRef.current.currentTime = 0;     
    }   
  };   

  const handleCloseMinimized = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsMinimizedClosed(true);
    handleStop();
  };   

  const handleForwardSearch = () => {     
    if (currentTrack?.id.startsWith("sample-")) {       
      setSongProgress((prev) => Math.min(songDuration || 100, prev + 10));       
      return;     
    }     
    if (audioRef.current) {       
      const target = Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + 10);       
      audioRef.current.currentTime = target;       
      setSongProgress(target);     
    }   
  };   

  const handleBackwardSearch = () => {     
    if (currentTrack?.id.startsWith("sample-")) {       
      setSongProgress((prev) => Math.max(0, prev - 10));       
      return;     
    }     
    if (audioRef.current) {       
      const target = Math.max(0, audioRef.current.currentTime - 10);       
      audioRef.current.currentTime = target;       
      setSongProgress(target);     
    }   
  };

  const handleNextTrack = () => {     
    const activeQueue = playbackQueue.length > 0 ? playbackQueue : playlist;
    if (activeQueue.length === 0) return;          
    stopSyntheticOsc();     
    
    const currentTrackId = currentTrack?.id;
    let queueIdx = activeQueue.findIndex(t => t.id === currentTrackId);
    if (queueIdx === -1) {
      queueIdx = Math.max(0, currentTrackIndex);
    }
    
    let nextQueueIdx = queueIdx;     
    if (repeatMode === "one") {
      nextQueueIdx = queueIdx;
    } else if (shuffleMode) {       
      nextQueueIdx = Math.floor(Math.random() * activeQueue.length);     
    } else {       
      nextQueueIdx = queueIdx + 1;
      if (nextQueueIdx >= activeQueue.length) {
        if (repeatMode === "all") {
          nextQueueIdx = 0;
        } else {
          // repeatMode === "none": stop playback
          setIsPlaying(false);
          setSongProgress(0);
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          }
          return;
        }
      }
    }     
    
    const selection = activeQueue[nextQueueIdx];
    if (selection) {
      setLoadedTrackId(selection.id);
      const mainIdx = playlist.findIndex(t => t.id === selection.id);
      if (mainIdx !== -1) {
        setCurrentTrackIndex(mainIdx);
      }
    }
    
    setIsPlaying(false);     
    setSongProgress(0);     
    setTimeout(() => {       
      if (selection && selection.id.startsWith("sample-")) {         
        handlePlaySynthetic(selection);       
      } else {         
        const audio = audioRef.current;         
        if (audio && selection) {           
          loadTrackSource(audio, selection);           
          ensureEngine();           
          audio.play()             
            .then(() => setIsPlaying(true))             
            .catch(err => console.log("Auto-play next track required visual activation gesture", err));         
        }       
      }     
    }, 120);   
  };   

  const handlePrevTrack = () => {     
    const activeQueue = playbackQueue.length > 0 ? playbackQueue : playlist;
    if (activeQueue.length === 0) return;          
    stopSyntheticOsc();     
    
    const currentTrackId = currentTrack?.id;
    let queueIdx = activeQueue.findIndex(t => t.id === currentTrackId);
    if (queueIdx === -1) {
      queueIdx = Math.max(0, currentTrackIndex);
    }
    
    let prevQueueIdx = queueIdx;     
    if (repeatMode === "one") {
      prevQueueIdx = queueIdx;
    } else if (shuffleMode) {       
      prevQueueIdx = Math.floor(Math.random() * activeQueue.length);     
    } else {       
      prevQueueIdx = queueIdx - 1;
      if (prevQueueIdx < 0) {
        if (repeatMode === "all") {
          prevQueueIdx = activeQueue.length - 1;
        } else {
          prevQueueIdx = 0;
        }
      }
    }     
    
    const selection = activeQueue[prevQueueIdx];
    if (selection) {
      setLoadedTrackId(selection.id);
      const mainIdx = playlist.findIndex(t => t.id === selection.id);
      if (mainIdx !== -1) {
        setCurrentTrackIndex(mainIdx);
      }
    }
    
    setIsPlaying(false);     
    setSongProgress(0);     
    setTimeout(() => {       
      if (selection && selection.id.startsWith("sample-")) {         
        handlePlaySynthetic(selection);       
      } else {         
        const audio = audioRef.current;         
        if (audio && selection) {           
          loadTrackSource(audio, selection);           
          ensureEngine();           
          audio.play()             
            .then(() => setIsPlaying(true))             
            .catch(err => console.log(err));         
        }       
      }     
    }, 125);   
  };

  const handlePlaySynthetic = (trackOverride?: Track) => {     
    ensureEngine();          
    stopSyntheticOsc();          
    const engine = engineRef.current;     
    if (!engine || !engine.ctx) return;          
    engine.resume();          
    const ctx = engine.ctx;     
    const osc = ctx.createOscillator();     
    const gainNode = ctx.createGain();          
    osc.connect(gainNode);     
    if (engine.analyser) {       
      gainNode.connect(engine.analyser);     
    } else {       
      gainNode.connect(ctx.destination);     
    }     
    const selTrack = trackOverride || playlist[currentTrackIndex];     
    if (!selTrack) return;     
    setCurrentSyntheticLabel(selTrack.name);          
    if (selTrack.id === "sample-40hz") {       
      osc.type = "sine";       
      osc.frequency.value = 40;       
      gainNode.gain.setValueAtTime(0.001, ctx.currentTime);       
      gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.1);       
      osc.start();     
    } else if (selTrack.id === "sample-sweep") {       
      osc.type = "sine";       
      osc.frequency.setValueAtTime(25, ctx.currentTime);       
      osc.frequency.exponentialRampToValueAtTime(130, ctx.currentTime + 10);       
      setupSweepRefresher(osc, ctx);              
      gainNode.gain.setValueAtTime(0.001, ctx.currentTime);       
      gainNode.gain.linearRampToValueAtTime(0.45, ctx.currentTime + 0.08);       
      osc.start();     
    } else if (selTrack.id === "sample-heavy") {       
      osc.type = "triangle";       
      osc.frequency.setValueAtTime(50, ctx.currentTime);       
      generateHipHopBassline(osc, gainNode, ctx);       
      osc.start();     
    }     
    setSyntheticOsc(osc);     
    setSyntheticGain(gainNode);     
    setIsPlaying(true);     
    setSongDuration(selTrack.duration);     
    setSongProgress(0);     
    const startProgressTime = Date.now();     
    const tickInterval = setInterval(() => {       
      if (!osc) {         
        clearInterval(tickInterval);         
        return;       
      }       
      const elapsed = (Date.now() - startProgressTime) / 1000;       
      if (elapsed >= selTrack.duration) {         
        clearInterval(tickInterval);         
        handleNextTrack();       
      } else {         
        setSongProgress(elapsed);       
      }     
    }, 200);   
    syntheticIntervalRef.current = tickInterval;
  };   

  const stopSyntheticOsc = () => {     
    if (syntheticIntervalRef.current) {
      clearInterval(syntheticIntervalRef.current);
      syntheticIntervalRef.current = null;
    }
    if (syntheticOsc) {       
      try {         
        syntheticOsc.stop();         
        syntheticOsc.disconnect();       
      } catch (e) {}       
      setSyntheticOsc(null);     
    }     
    if (syntheticGain) {       
      try {         
        syntheticGain.disconnect();       
      } catch (e) {}       
      setSyntheticGain(null);     
    }     
    setCurrentSyntheticLabel("");   
  };   

  const setupSweepRefresher = (osc: OscillatorNode, ctx: AudioContext) => {     
    let tick = 0;     
    const interval = setInterval(() => {       
      if (!syntheticOsc || syntheticOsc !== osc) {         
        clearInterval(interval);         
        return;       
      }       
      tick++;       
      const currentMultiplier = (tick % 2 === 0) ? 25 : 35;       
      const targetHz = (tick % 2 === 0) ? 130 : 25;              
      try {         
        osc.frequency.setValueAtTime(currentMultiplier, ctx.currentTime);         
        osc.frequency.exponentialRampToValueAtTime(targetHz, ctx.currentTime + 6);       
      } catch (e) {         
        clearInterval(interval);       
      }     
    }, 6000);   
  };   

  const generateHipHopBassline = (osc: OscillatorNode, gain: GainNode, ctx: AudioContext) => {     
    let beats = 0;     
    const beatInterval = setInterval(() => {       
      if (!syntheticOsc || syntheticOsc !== osc) {         
        clearInterval(beatInterval);         
        return;       
      }       
      beats++;       
      const time = ctx.currentTime;              
      try {         
        osc.frequency.setValueAtTime(120, time);         
        osc.frequency.exponentialRampToValueAtTime(38, time + 0.3);         
        gain.gain.setValueAtTime(0.01, time);         
        gain.gain.linearRampToValueAtTime(0.7, time + 0.05);         
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.55);         
        if (beats % 4 === 0) {           
          setTimeout(() => {             
            if (!syntheticOsc) return;             
            osc.frequency.setValueAtTime(45, ctx.currentTime);             
            osc.frequency.linearRampToValueAtTime(41, ctx.currentTime + 0.8);             
            gain.gain.setValueAtTime(0.01, ctx.currentTime);             
            gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.1);             
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.25);           
          }, 600);         
        }       
      } catch (e) {         
        clearInterval(beatInterval);       
      }     
    }, 1400);   
  };   

  const handleSeek = (progressSeconds: number) => {     
    if (currentTrack?.id.startsWith("sample-")) {       
      setSongProgress(progressSeconds);       
      return;     
    }     
    if (audioRef.current) {       
      audioRef.current.currentTime = progressSeconds;       
      setSongProgress(progressSeconds);     
    }   
  };   

  const deleteTrack = async (idx: number, e: React.MouseEvent) => {     
    e.stopPropagation();     
    const track = playlist[idx];     
    if (!track) return;     
    if (track.id.startsWith("sample-")) {       
      const updated = [...playlist];       
      updated.splice(idx, 1);       
      setPlaylist(updated);       
      if (currentTrackIndex === idx) {         
        stopSyntheticOsc();         
        setIsPlaying(false);         
        setCurrentTrackIndex(updated.length > 0 ? 0 : -1);       
      } else if (currentTrackIndex > idx) {         
        setCurrentTrackIndex(currentTrackIndex - 1);       
      }       
      return;     
    }     
    try {       
      await deleteDoc(doc(db, "tracks", track.id));       
      console.log("Track safely wiped from Firestore:", track.id);       
      if (currentTrackIndex === idx) {         
        stopSyntheticOsc();         
        setIsPlaying(false);         
        if (audioRef.current) audioRef.current.pause();         
        setCurrentTrackIndex(-1);       
      } else if (currentTrackIndex > idx) {         
        setCurrentTrackIndex(currentTrackIndex - 1);       
      }     
    } catch (err) {       
      handleFirestoreError(err, OperationType.DELETE, `tracks/${track.id}`);     
    }   
  };   

  const onPlayTrackById = (trackId: string, customQueue?: Track[]) => {
    const queueToUse = customQueue && customQueue.length > 0 ? customQueue : playlist;
    setPlaybackQueue(queueToUse);
    
    const idx = queueToUse.findIndex((t) => t.id === trackId);
    if (idx === -1) return;
    
    stopSyntheticOsc();
    setLoadedTrackId(trackId);
    
    const mainIdx = playlist.findIndex((t) => t.id === trackId);
    if (mainIdx !== -1) {
      setCurrentTrackIndex(mainIdx);
    }
    
    setIsPlaying(false);
    setCurrentView("player");
    setTimeout(() => {
      const track = queueToUse[idx];
      if (track) {
        if (track.id.startsWith("sample-")) {
          handlePlaySynthetic(track);
        } else {
          const audio = audioRef.current;
          if (audio) {
            loadTrackSource(audio, track);
            ensureEngine();
            audio.play()
              .then(() => setIsPlaying(true))
              .catch((err) => console.log(err));
          }
        }
      }
    }, 50);
  };

  const deleteSelectedTracks = async (trackIds: string[]) => {
    if (trackIds.length === 0) return;
    const localIds = trackIds.filter(id => id.startsWith("local-"));
    const cloudIds = trackIds.filter(id => !id.startsWith("local-") && !id.startsWith("sample-"));

    for (const cid of cloudIds) {
      try {
        await deleteDoc(doc(db, "tracks", cid));
        console.log("Deleted cloud track safely:", cid);
      } catch (err) {
        console.error("Failed deleting cloud track:", cid, err);
      }
    }

    setPlaylist((prev) => {
      const remaining = prev.filter(t => !localIds.includes(t.id));
      const currentPlayingTrack = prev[currentTrackIndex];
      if (currentPlayingTrack && trackIds.includes(currentPlayingTrack.id)) {
        stopSyntheticOsc();
        setIsPlaying(false);
        if (audioRef.current) audioRef.current.pause();
        setCurrentTrackIndex(-1);
      } else if (currentPlayingTrack) {
        const newIdx = remaining.findIndex(t => t.id === currentPlayingTrack.id);
        setCurrentTrackIndex(newIdx);
      }
      return remaining;
    });
  };   

  const handleEqValueChange = (bandIdx: number, newGainDb: number) => {     
    setSelectedPresetName("Custom Manual Tuning");     
    const updatedBands = [...dspSettings.eqBands];     
    updatedBands[bandIdx] = newGainDb;          
    const updatedSettings = {       
      ...dspSettings,       
      eqBands: updatedBands     
    };          
    setDspSettings(updatedSettings);          
    if (engineRef.current) {       
      engineRef.current.setEqBand(bandIdx, newGainDb);     
    }   
  };   

  const handleBassKnobChange = (newLevel: number) => {     
    setSelectedPresetName("Custom Manual Tuning");     
    setIsMaxBass(newLevel >= 100);          
    const updatedSettings = {       
      ...dspSettings,       
      bassBoost: newLevel     
    };     
    setDspSettings(updatedSettings);     
    if (engineRef.current) {       
      engineRef.current.setBassBoost(newLevel);     
    }   
  };   

  const toggleMaxBass = () => {     
    ensureEngine();          
    if (isMaxBass) {       
      setIsMaxBass(false);       
      handleBassKnobChange(50.0);     
    } else {       
      setIsMaxBass(true);       
      handleBassKnobChange(100.0);       
      setShowAtomicExplosion(true);              
      if (typeof window !== "undefined" && window.navigator && typeof window.navigator.vibrate === "function") {         
        window.navigator.vibrate([150, 50, 300, 50, 400, 50, 500, 50, 450]);       
      }       
      setTimeout(() => {         
        setShowAtomicExplosion(false);       
      }, 2200);              
      const updatedBands = [...dspSettings.eqBands];       
      updatedBands[0] = 12;              
      const updatedSettings = {         
        ...dspSettings,         
        eqBands: updatedBands,         
        bassBoost: 100.0       
      };       
      setDspSettings(updatedSettings);              
      if (engineRef.current) {         
        engineRef.current.setEqBand(0, 12);         
        engineRef.current.setBassBoost(100.0);       
      }     
    }   
  };   

  const applyAudioPreset = (preset: Preset) => {     
    if (preset.isPremium && subscriptionTier !== "paid") {
      setGlobalPremiumPrompt(`The custom EQ Preset '${preset.name}' is a premium feature. Upgrade to unlock high-fidelity sound-engineering presets!`);
      setCurrentView("upgrade");
      return;
    }
    ensureEngine();     
    setSelectedPresetName(preset.name);     
    setIsMaxBass(preset.bassBoost >= 95);     
    const targetBands = preset.name === "Custom" ? (customEqBands || [0, 0, 0, 0, 0]) : preset.eqBands;
    const updatedSettings = {       
      ...dspSettings,       
      eqBands: [...targetBands],       
      bassBoost: preset.bassBoost,       
      reverbWet: preset.reverbWet,       
      delayOffsetMs: preset.delayOffsetMs     
    };     
    setDspSettings(updatedSettings);     
    if (engineRef.current) {       
      engineRef.current.applyDspSettings(updatedSettings);     
    }   
  };   

  const resetAllFlat = () => {     
    applyAudioPreset(BUILTIN_PRESETS[0]);   
  };   

  const handleSaveCustomPreset = async () => {
    const bandsToSave = [...dspSettings.eqBands];
    setCustomEqBands(bandsToSave);
    try {
      localStorage.setItem("thumplayer_custom_eq_bands", JSON.stringify(bandsToSave));
    } catch (e) {
      console.warn("localStorage quota exceeded or blocked:", e);
    }
    
    if (currentUser) {
      try {
        const userDocRef = doc(db, "users", currentUser.uid);
        await setDoc(userDocRef, {
          customEqBands: bandsToSave,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        console.log("Custom EQ preset saved to Firestore:", bandsToSave);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}`);
      }
    }
  };

  const handleResetCustomPreset = async () => {
    setCustomEqBands(null);
    try {
      localStorage.removeItem("thumplayer_custom_eq_bands");
    } catch (e) {
      console.warn("localStorage block:", e);
    }
    
    // Reset eqBands to default flat levels: [0, 0, 0, 0, 0]
    const updatedSettings = {
      ...dspSettings,
      eqBands: [0, 0, 0, 0, 0]
    };
    setDspSettings(updatedSettings);
    if (engineRef.current) {
      engineRef.current.applyDspSettings(updatedSettings);
    }
    setSelectedPresetName("Custom");

    if (currentUser) {
      try {
        const userDocRef = doc(db, "users", currentUser.uid);
        await setDoc(userDocRef, {
          customEqBands: null,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        console.log("Custom EQ preset reset in Firestore");
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}`);
      }
    }
  };

  const handleAiOptimize = async (easyModeSetting?: boolean, customCarModel?: string) => {     
    if (subscriptionTier !== "paid") {
      setGlobalPremiumPrompt("AI Audio Frequency Optimization & Spatial Acoustic Calibration is a premium feature. Upgrade to achieve maximum acoustic clarity and remaster your studio files!");
      setCurrentView("upgrade");
      return;
    }
    ensureEngine();     
    setIsOptimizing(true);          
    try {       
      const activeName = currentTrack ? currentTrack.name : "Cabin Test Beat";       
      const activeGenre = currentTrack ? currentTrack.genre : "Dynamic Acoustic";       
      let friendlySoundPref = vehicleInfo.soundPreference;
      if (vehicleInfo.soundPreference === "Balanced") friendlySoundPref = "High Clarity & Detail";
      else if (vehicleInfo.soundPreference === "SQL (Sound Quality Loud)") friendlySoundPref = "Rich, Warm & Energetic";
      else if (vehicleInfo.soundPreference === "SPL (Maximum Bass Head)") friendlySoundPref = "Deep Bass Thump";
      else if (vehicleInfo.soundPreference === "Vocal-centric") friendlySoundPref = "Crisp Vocals & Clear Melodies";

      const response = await fetch("/api/optimize", {         
        method: "POST",         
        headers: { "Content-Type": "application/json" },         
        body: JSON.stringify({           
          songTitle: activeName,           
          genre: activeGenre,           
          vehicleType: vehicleInfo.vehicleType,           
          subwooferConfig: vehicleInfo.subwooferConfig,           
          soundPreference: friendlySoundPref,
          environmentMode: vehicleInfo.vehicleType,
          userEquipment: vehicleInfo.subwooferConfig,
          easyMode: easyModeSetting || false,
          carYearMakeModel: customCarModel || ""
        })       });       
      if (!response.ok) throw new Error("DSP Optimization query failed from server API");       
      const optimalSettings: DspSettings & { success: boolean, isFallback?: boolean } = await response.json();              
      if (optimalSettings.success) {         
        const scaledBassBoost = (optimalSettings.bassBoost || 0) * 10;         
        const finalSettings = {           
          eqBands: optimalSettings.eqBands,           
          bassBoost: scaledBassBoost,           
          reverbWet: optimalSettings.reverbWet,           
          delayOffsetMs: optimalSettings.delayOffsetMs,           
          highPassFilterHz: optimalSettings.highPassFilterHz,           
          subCrossoverHz: optimalSettings.subCrossoverHz,           
          justification: optimalSettings.justification         
        };         
        setDspSettings(finalSettings);         
        setSelectedPresetName(easyModeSetting ? "AI Easy Calibrated Profile" : "AI Optimized DSP Profile");         
        setIsMaxBass(scaledBassBoost >= 95);         
        if (engineRef.current) {           
          engineRef.current.applyDspSettings(finalSettings);         
        }       
      }     
    } catch (err) {       
      console.error("AI DSP Optimization error: ", err);     
    } finally {       
      setIsOptimizing(false);     
    }   
  };   

  const formatTime = (secs: number) => {     
    const m = Math.floor(secs / 60);     
    const s = Math.floor(secs % 60);     
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;   
  };   

  useEffect(() => {     
    return () => {       
      stopSyntheticOsc();     
    };   
  }, []);   

  const glassShards = useMemo(() => {     
    const count = 75;     
    const clipPaths = [       
      "polygon(10% 0%, 100% 20%, 80% 90%, 0% 70%)",       
      "polygon(50% 0%, 100% 100%, 0% 80%)",       
      "polygon(0% 15%, 90% 0%, 100% 85%, 15% 100%)",       
      "polygon(20% 0%, 100% 0%, 80% 100%, 0% 100%)",       
      "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
      "polygon(30% 0%, 100% 30%, 70% 100%, 0% 80%)",
      "polygon(0% 0%, 90% 10%, 100% 90%, 10% 100%)"
    ];     
    return Array.from({ length: count }).map((_, i) => {       
      const angle = (i / count) * 2 * Math.PI + (Math.random() * 0.4 - 0.2);       
      const distPercent = i % 3 === 0 ? 0.25 : i % 3 === 1 ? 0.55 : 0.85;       
      const distance = (120 + Math.random() * 520) * (distPercent + 0.35);       
      const tx = Math.cos(angle) * distance;       
      const ty = Math.sin(angle) * distance;       
      const rotX = Math.floor(Math.random() * 720 - 360);        
      const rotY = Math.floor(Math.random() * 720 - 360);        
      const rotZ = Math.floor(Math.random() * 720 - 360);        
      const width = Math.floor(Math.random() * 22 + 8);       
      const height = Math.floor(Math.random() * 32 + 10);       
      const delay = (Math.random() * 0.12).toFixed(3);       
      const clipPath = clipPaths[i % clipPaths.length];       
      return {         
        id: i,         
        width: `${width}px`,         
        height: `${height}px`,         
        clipPath,         
        delay: `${delay}s`,         
        tx: `${tx}px`,         
        ty: `${ty}px`,         
        rotX: `${rotX}deg`,
        rotY: `${rotY}deg`,
        rotZ: `${rotZ}deg`
      };     
    });   
  }, [showAtomicExplosion]);   

  return (     
    <div id="app-container" className={`min-h-screen candy-paint-body text-slate-100 flex flex-col font-sans select-none overflow-x-hidden ${showAtomicExplosion ? "glass-shaking" : ""}`}>              
      {/* Global Backdrop Overlay when dropdown is open */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/80 z-[1000] backdrop-blur-xs"
          />
        )}
      </AnimatePresence>

      {/* Global Dropdown Menu in the upper left hand corner of all pages */}
      <div id="global-menu-container" className="fixed top-5 left-5 z-[1101] select-none">
        <button
          id="global-menu-btn"
          onClick={toggleMenu}
          className={`p-3.5 px-4.5 rounded-2xl border-2 flex items-center justify-center transition-all duration-150 cursor-pointer shadow-[0_6px_20px_rgba(0,0,0,0.65)] ${
            isOpen
              ? "bg-white/10 border-white text-white scale-105 shadow-[0_0_20px_rgba(255,255,255,0.4)]"
              : "bg-[#020512]/95 border-slate-800 text-slate-300 hover:text-white hover:border-slate-500 hover:scale-105"
          }`}
          title="Open Menu"
        >
          {isOpen ? <X className="w-5 h-5 animate-pulse" /> : <Menu className="w-5 h-5" />}
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -15, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute left-0 mt-4 w-80 rounded-3xl bg-gradient-to-br from-[#0c1328] via-[#040814] to-[#010307] border-2 border-[#1f3050] shadow-[0_25px_60px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col gap-2.5 p-4 z-[1102]"
            >
              {/* Logo at the top - scaled up */}
              <div className="flex flex-col items-center justify-center py-5 border-b-2 border-[#1f3050]/65 mb-4 px-4 bg-black/35 rounded-t-2xl gap-2.5">
                <img src="/logo.png" alt="" referrerPolicy="no-referrer" className="w-16 h-16 rounded-xl object-cover shadow-[0_0_15px_rgba(255,255,255,0.2)] mb-1" />
                <span className="text-lg font-sans font-semibold tracking-[0.2em] text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.65)] select-none text-center">QUANTUMPLAYERAI</span>
                {currentUser?.email === "jkoehler319@gmail.com" && (
                  <div className="flex flex-col items-center gap-1 bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-2xl w-full text-center shadow-[0_0_15px_rgba(245,158,11,0.08)]">
                    <span className="text-[9px] font-sans font-bold uppercase tracking-widest text-amber-400">ADMINISTRATOR PROFILE</span>
                    <span className="text-[8.5px] font-sans text-stone-300 font-light lowercase">{currentUser.email}</span>
                    <span className="text-[8px] font-sans font-bold uppercase tracking-wider text-emerald-400 mt-0.5">UNLIMITED ELITE TIER ACTIVE</span>
                  </div>
                )}
              </div>
              {/* Options - larger fonts, increased spacing */}
              <button
                onClick={() => {
                  if (isLoggedIn) {
                    setCurrentView("player");
                  } else {
                    setCurrentView("auth");
                  }
                  setIsOpen(false);
                }}
                className={`w-full text-left font-sans font-medium uppercase tracking-widest text-[11px] sm:text-[12px] px-4 py-3.5 rounded-xl transition-all duration-100 border border-transparent cursor-pointer ${
                  currentView === "player"
                    ? "bg-white/10 border-2 border-slate-350 text-white shadow-[0_0_12px_rgba(255,255,255,0.2)] font-semibold"
                    : "text-slate-200 hover:bg-slate-900/65 hover:text-white hover:pl-5"
                }`}
              >
                Audio Player
              </button>

              <button
                onClick={() => {
                  if (isLoggedIn) {
                    setCurrentView("video");
                  } else {
                    setCurrentView("auth");
                  }
                  setIsOpen(false);
                }}
                className={`w-full text-left font-sans font-medium uppercase tracking-widest text-[11px] sm:text-[12px] px-4 py-3.5 rounded-xl transition-all duration-100 border border-transparent cursor-pointer ${
                  currentView === "video"
                    ? "bg-white/10 border-2 border-slate-350 text-white shadow-[0_0_12px_rgba(255,255,255,0.25)] font-semibold"
                    : "text-slate-200 hover:bg-slate-900/65 hover:text-white hover:pl-5"
                }`}
              >
                AI 4K Video Player
              </button>

              <button
                onClick={() => {
                  if (isLoggedIn) {
                    setCurrentView("mymusic");
                  } else {
                    setCurrentView("auth");
                  }
                  setIsOpen(false);
                }}
                className={`w-full text-left font-sans font-medium uppercase tracking-widest text-[11px] sm:text-[12px] px-4 py-3.5 rounded-xl transition-all duration-100 border border-transparent cursor-pointer ${
                  currentView === "mymusic"
                    ? "bg-white/10 border-2 border-slate-350 text-white shadow-[0_0_12px_rgba(255,255,255,0.2)] font-semibold"
                    : "text-slate-200 hover:bg-slate-900/65 hover:text-white hover:pl-5"
                }`}
              >
                My music
              </button>

              <button
                onClick={() => {
                  if (isLoggedIn) {
                    setCurrentView("upgrade");
                  } else {
                    setCurrentView("auth");
                  }
                  setIsOpen(false);
                }}
                className={`w-full text-left font-sans font-medium uppercase tracking-widest text-[11px] sm:text-[12px] px-4 py-3.5 rounded-xl transition-all duration-100 border border-transparent cursor-pointer ${
                  currentView === "upgrade"
                    ? "bg-white/10 border-2 border-slate-350 text-white shadow-[0_0_12px_rgba(255,255,255,0.25)] font-semibold"
                    : "text-slate-200 hover:bg-slate-900/65 hover:text-white hover:pl-5"
                }`}
              >
                Upgrade
              </button>

              <button
                onClick={() => {
                  if (isLoggedIn) {
                    setCurrentView("ai_enhancement");
                  } else {
                    setCurrentView("auth");
                  }
                  setIsOpen(false);
                }}
                className={`w-full text-left font-sans font-medium uppercase tracking-widest text-[11px] sm:text-[12px] px-4 py-3.5 rounded-xl transition-all duration-100 border border-transparent cursor-pointer ${
                  currentView === "ai_enhancement"
                    ? "bg-white/10 border-2 border-slate-350 text-white shadow-[0_0_12px_rgba(255,255,255,0.25)] font-semibold"
                    : "text-slate-200 hover:bg-slate-900/65 hover:text-white hover:pl-5"
                }`}
              >
                Ai Enhancement and optimization
              </button>

              <div className="border-t border-[#1f3050]/60 my-2 mx-1" />
              
              <button
                onClick={async () => {
                  if (isLoggedIn) {
                    try {
                      await signOut(auth);
                    } catch (err) {
                      console.error("Error signing out:", err);
                    }
                  }
                  setIsOpen(false);
                  setCurrentView("landing");
                }}
                className="w-full text-left font-sans font-medium uppercase tracking-widest text-[11px] sm:text-[12px] px-4 py-3.5 rounded-xl transition-all duration-100 text-red-400 hover:bg-red-500/10 border border-transparent cursor-pointer hover:pl-5"
              >
                Log Out
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {showAtomicExplosion && (         
        <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden select-none">           
          {/* Subtle ice blue glare flash */}
          <div className="absolute inset-0 bg-sky-200/20 mix-blend-overlay animate-pulse" style={{ animationDuration: '0.4s' }} />           
          
          {/* SVG Animated glass crack web pattern */}
          <div className="absolute inset-0 w-full h-full animate-glass-crack flex items-center justify-center">
            <svg 
              className="w-full h-full text-white/95 drop-shadow-[0_0_12px_rgba(255,255,255,0.7)] stroke-white" 
              viewBox="0 0 1000 1000" 
              preserveAspectRatio="none"
              style={{ strokeWidth: '1.2px', strokeLinecap: 'round', fill: 'none' }}
            >
              {/* Main radial fracture rays starting from screen center (500,500) */}
              <path d="M500,500 L120,80 L220,150 L50,450 L100,550 L180,820 L400,950 L520,980 L880,900 L950,550 L920,400 L850,150 L750,50 Z" stroke="rgba(255, 255, 255, 0.4)" strokeWidth="0.5" />
              <path d="M500,500 L150,100" />
              <path d="M500,500 L80,320" />
              <path d="M500,500 L50,580" />
              <path d="M500,500 L250,880" />
              <path d="M500,500 L550,950" />
              <path d="M500,500 L820,820" />
              <path d="M500,500 L950,480" />
              <path d="M500,500 L900,220" />
              <path d="M500,500 L620,80" />
              <path d="M500,500 L380,50" />

              {/* Sub-branch fractures */}
              <path d="M325,300 L200,220 L110,250" />
              <path d="M290,410 L180,420 L70,390" />
              <path d="M275,540 L190,620 L80,680" />
              <path d="M375,690 L300,820 L220,900" />
              <path d="M525,725 L620,880 L680,950" />
              <path d="M660,660 L800,750 L910,810" />
              <path d="M725,490 L850,510 L980,490" />
              <path d="M680,310 L820,280 L950,220" />
              <path d="M560,290 L680,180 L740,90" />
              
              {/* Concentric fracture rings */}
              <path d="M470,500 A30,30 0 0,1 530,500 A30,30 0 0,1 470,500 Z" />
              <path d="M420,500 A80,80 0 0,1 580,500 A80,80 0 0,1 420,500 Z" strokeWidth="0.8" />
              <path d="M350,500 A150,150 0 0,1 650,500 A150,150 0 0,1 350,500 Z" strokeWidth="0.6" strokeDasharray="15,10,30,10" />
              <path d="M250,500 A250,250 0 0,1 750,500 A250,250 0 0,1 250,500 Z" strokeWidth="0.4" strokeDasharray="40,15,10,20" />
              <path d="M120,500 A380,380 0 0,1 880,500 A380,380 0 0,1 120,500 Z" strokeWidth="0.3" strokeDasharray="10,25" />
            </svg>
          </div>

          <div className="absolute top-1/2 left-1/2 w-0 h-0">             
            {glassShards.map((shard) => (               
              <div                 
                key={shard.id}                 
                className="glass-shard-premium"                 
                style={{                   
                  width: shard.width,                   
                  height: shard.height,                   
                  clipPath: shard.clipPath,                   
                  animationDelay: shard.delay,                   
                  "--tx": shard.tx,                   
                  "--ty": shard.ty,                   
                  "--rotX": shard.rotX,                 
                  "--rotY": shard.rotY,                 
                  "--rotZ": shard.rotZ,                 
                } as React.CSSProperties}               
              />             
            ))}           
          </div>                   <div className="absolute inset-0 flex flex-col items-center justify-center bg-transparent">             
            <div className="text-center p-6 bg-stone-950/95 border-2 border-white/40 rounded-2xl shadow-[0_0_60px_rgba(255,255,255,0.25)] transform scale-110 duration-200 backdrop-blur-md">               
              <span className="text-[10px] font-sans font-semibold text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.65)] uppercase tracking-[0.25em] block mb-1">                   
                CABIN PRESSURE RESISTANCE BREACHED
              </span>               
              <h2 className="text-2xl font-sans font-medium text-white uppercase tracking-wider animate-pulse">                 
                💥 GLASS SHATTERED!               
              </h2>               
              <span className="text-[10px] font-sans text-stone-300 block mt-2 uppercase font-medium tracking-widest">                 
                100% MAXIMUM BASS IMPACT ENGAGED               
              </span>             
            </div>           
          </div>         
        </div>       
      )}       <audio ref={audioRef} className="hidden" />       

      <div className="flex items-center justify-center gap-2 mt-4 mb-2">
        <img src="/logo.png" alt="" referrerPolicy="no-referrer" className="w-5 h-5 rounded object-cover shadow-[0_0_6px_rgba(255,255,255,0.2)]" />
        <span className="text-base font-sans font-semibold tracking-[0.25em] text-white select-none block drop-shadow-[0_0_12px_rgba(255,255,255,0.4)]">QUANTUMPLAYERAI</span>
      </div>
      {authLoading ? (
        <div id="auth-loading-screen" className="flex-1 w-full max-w-xl mx-auto px-4 py-8 flex flex-col justify-center items-center min-h-screen relative z-30">
          <div className="text-center p-8 bg-stone-950/95 border-2 border-white/40 rounded-[2rem] shadow-[0_0_50px_rgba(255,255,255,0.18)] max-w-sm w-full mx-auto select-none backdrop-blur-md">
            <div className="flex flex-col items-center justify-center gap-3 mb-6 animate-pulse">
              <img src="/logo.png" alt="" referrerPolicy="no-referrer" className="w-12 h-12 rounded-xl object-cover shadow-[0_0_10px_rgba(255,255,255,0.3)] animate-pulse" />
              <span className="text-base font-sans font-semibold tracking-[0.25em] text-white select-none">QUANTUMPLAYERAI</span>
            </div>
            
            <div className="flex items-center justify-center gap-3 mt-4 mb-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
              </span>
              <span className="text-[10px] font-sans font-semibold text-white uppercase tracking-widest">
                VERIFYING SECURE SESSION
              </span>
            </div>
            
            <p className="text-[10px] font-sans text-slate-400 uppercase mt-1 leading-relaxed tracking-wider font-light">
              Establishing digital handshake...
            </p>
          </div>
        </div>
      ) : (!isLoggedIn && (currentView === "auth" || (currentView !== "landing" && currentView !== "privacy" && currentView !== "agreement"))) ? (
        <AuthView auth={auth} onSuccess={() => { setIsLoggedIn(true); setCurrentView("player"); }} onBack={() => { setCurrentView("landing"); }} />
      ) : (
        <>
          {currentView === "landing" && (         
        <div className="flex-1 w-full max-w-xl mx-auto px-4 py-8 flex flex-col justify-between items-center relative min-h-screen">                      
          <div className="my-auto flex flex-col items-center justify-center text-center w-full max-w-md py-6">                          
            <div className="relative w-full max-w-[320px] mx-auto mb-8 overflow-hidden group rounded-3xl">               
              <img 
                src="/logo.png" 
                alt="QUANTUMPLAYERAI Logo" 
                referrerPolicy="no-referrer"
                className="w-full h-auto aspect-square rounded-3xl object-cover transition-transform duration-500 group-hover:scale-105 shadow-[0_15px_40px_rgba(0,0,0,0.8)]"
              />
            </div>             
            <h1 className="text-base md:text-lg font-semibold font-sans tracking-widest text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-200 to-slate-400 uppercase leading-snug drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] px-2 text-center">               
              Professional Music Player & Ai Audio Enhancement and Optimization             
            </h1>             
            <div className="w-16 h-1 bg-white rounded-full my-6 shadow-[0_0_12px_rgba(255,255,255,0.65)] opacity-80" />             
            <p className="text-[12px] font-sans font-light text-slate-300 leading-relaxed bg-slate-950/65 p-5 rounded-2xl border border-slate-900 shadow-xl text-center tracking-wide">
              <strong>QUANTUMPLAYERAI</strong> is a high-fidelity offline music player and advanced sound enhancer. Elevate your local MP3, WAV, and FLAC files with an interactive volume booster, 5-band equalizer, and instant bass booster online. Upgrade to unlock custom acoustic room correction powered by the Google Gemini API—tailored perfectly for your headphones, home stereo, car cabin, or surround sound layout.
            </p>             
            <div className="flex flex-wrap items-center justify-center gap-1.5 mt-4 max-w-md px-2">
              {[
                "Online MP3 Player",
                "Low-Latency Audio Enhancer",
                "Mobile Volume Booster",
                "Local WAV/FLAC Playback",
                "Real-Time Web DSP Array",
                "Headphone Soundstage Expander"
              ].map((badge, i) => (
                <span key={i} className="text-[8.5px] font-sans font-semibold text-slate-400 bg-white/[0.03] hover:bg-white/[0.06] px-2.5 py-1 rounded-full border border-white/10 tracking-wider transition-colors duration-100 select-none">
                  {badge}
                </span>
              ))}
            </div>
            <button               
              onClick={() => {                 
                if (currentUser) setCurrentView("player");                 
                else setCurrentView("auth");               
              }}               
              className="mt-8 px-6 py-3 rounded-xl font-sans text-xs font-semibold tracking-widest uppercase cursor-pointer select-none bg-gradient-to-r from-slate-200/20 via-white/10 to-slate-400/25 border-2 border-slate-450 text-white shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:from-white hover:via-slate-100 hover:to-slate-300 hover:text-stone-950 hover:border-white hover:shadow-[0_0_30px_rgba(255,255,255,0.45)] active:scale-95 duration-100 transition-all flex items-center gap-2"             
            >               
              {currentUser ? "Enter App" : "Log In"}             
            </button>           
          </div>           
          <footer className="w-full text-center mt-auto pt-6 border-t border-slate-900/60 flex flex-col sm:flex-row items-center justify-center gap-3 text-[10px] font-sans text-slate-400 uppercase tracking-widest pb-2">             
            <span className="opacity-60 text-[9px] tracking-wider">  2026 Studio Player</span>             
            <span className="hidden sm:inline text-slate-800">|</span>             
            <div className="flex gap-4">               
              <button onClick={() => setCurrentView("privacy")} className="hover:text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.5)] transition-colors cursor-pointer underline decoration-dotted underline-offset-4">                 
                Privacy Policy               
              </button>               
              <button onClick={() => setCurrentView("agreement")} className="hover:text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.5)] transition-colors cursor-pointer underline decoration-dotted underline-offset-4">                 
                User Agreements               
              </button>             
            </div>           
          </footer>         
        </div>       
      )}       
      {currentView === "privacy" && (         
        <div className="flex-1 w-full max-w-xl mx-auto px-4 py-8 flex flex-col min-h-screen justify-between relative">                      
          <div className="my-auto max-w-md mx-auto w-full flex flex-col gap-5 py-6">             
            <div className="flex items-center gap-3 border-b border-slate-850 pb-3">               
              <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">                 
                <Info className="w-4.5 h-4.5" />               
              </div>               
              <div>                 
                <h1 className="text-sm font-semibold font-sans tracking-widest text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)] uppercase">                   
                  Privacy Policy                 
                </h1>                 
                <p className="text-[8px] font-sans text-slate-500 uppercase tracking-wider mt-0.5">Placeholder Host: https://quantumplayer.ai/privacy-policy</p>               
              </div>             
            </div>             
            <div className="text-xs font-sans text-slate-300/90 leading-relaxed bg-slate-950/75 border border-slate-900 rounded-2xl p-5 shadow-2xl flex flex-col gap-4 overflow-y-auto max-h-[350px] font-light">               
              <p className="font-semibold text-white text-xs border-b border-slate-800 pb-1">1. SECURE LOCAL AUDIO DATA HANDSHAKES</p>               
              <p>QUANTUMPLAYERAI respects your personal audio content. All loaded MP3, WAV or track collections are handled entirely client-side using the local browser Web Audio API environment or cached securely using high-speed IndexedDB and LocalStorage wrappers.</p>               
              <p>We do not transfer, harvest, or index your original music audio byte data to any unauthorized external databases.</p>               
              <p className="font-semibold text-white text-xs border-b border-slate-800 pb-1">2. ANONYMOUS HANDSHAKE TRACKING</p>               
              <p>When synced to Cloud Storage catalog, persistent metadata pointers (such as track filename, length, upload timestamps) are saved in a sandboxed, anonymous Firestore directory matching your temporary profile credential key.</p>               
              <p>This ensures that your playlist catalog stays fully synchronized without requiring any confidential tracking telemetry.</p>               
              <p className="font-semibold text-white text-xs border-b border-slate-800 pb-1">3. THIRD-PARTY DISCLOSURES & INTEGRATION</p>               
              <p>Our services do not deploy any hidden analytical cookies, tracker pixels, or secondary telemetry systems. The workspace runs inside an isolated container with zero secondary data harvesting policies.</p>             
            </div>             
            <button               
              onClick={() => setCurrentView("landing")}               
              className="mt-4 px-6 py-2.5 rounded-xl font-sans text-[10px] font-semibold tracking-widest text-center uppercase cursor-pointer select-none bg-slate-900 border border-slate-800 hover:border-slate-500 text-slate-300 hover:text-white transition-all transform hover:scale-102 active:scale-95 animate-none"             
            >                 
              Return to Home View             
            </button>           
          </div>           
          <footer className="w-full text-center mt-auto pt-6 text-[9px] font-sans text-slate-500 uppercase tracking-widest">             
            Placeholder Host Domain: https://quantumplayer.ai           
          </footer>         
        </div>       
      )}       
      {currentView === "agreement" && (         
        <div className="flex-1 w-full max-w-xl mx-auto px-4 py-8 flex flex-col min-h-screen justify-between relative">                      
          <div className="my-auto max-w-md mx-auto w-full flex flex-col gap-5 py-6">             
            <div className="flex items-center gap-3 border-b border-slate-850 pb-3">               
              <div className="p-2 rounded-xl bg-orange-650/15 text-orange-400 border border-orange-500/30">                 
                <AlertTriangle className="w-4.5 h-4.5" />               
              </div>               
              <div>                 
                <h1 className="text-sm font-semibold font-sans tracking-widest text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)] uppercase">                   
                  User Agreements                 
                </h1>                 
                <p className="text-[8px] font-sans text-slate-500 uppercase tracking-wider mt-0.5">Placeholder Host: https://quantumplayer.ai/user-agreement</p>               
              </div>             
            </div>             
            <div className="text-xs font-sans text-slate-300/90 leading-relaxed bg-[#020512]/90 border border-slate-800/80 rounded-2xl p-5 shadow-2xl flex flex-col gap-4 overflow-y-auto max-h-[350px] font-light">               
              <p className="font-semibold text-white text-xs border-b border-slate-800 pb-1">1. INTENT OF APP USE</p>               
              <p>By booting the QUANTUMPLAYERAI digital sound processing (DSP) environment, you acquire a non-transferable runtime access license to optimize local and synchronized audio files inside your container.</p>               
              <p className="font-semibold text-red-400 text-xs border-b border-slate-850 pb-1">2. SUBWOOFER CLIPPING & COMP BASS WARNING</p>               
              <p className="text-red-350">QUANTUMPLAYERAI CONTAINS HIGH-GAIN ANALOG-EMULATED BASS BOOST GAIN CONTROLS & AN ATOMIC MAX BASS SHOCKWAVE SWITCH capable of severe SPL output swings. BY AGREEMENT, USER TAKES FULL RESPONSIBILITY FOR SOUND INTENSITY AND SPEAKER RIG HARDWARE DAMAGE FROM OVER-EXCURSION OR CLIPPING.</p>               
              <p className="font-semibold text-white text-xs border-b border-slate-800 pb-1">3. CLOUD DEPLOYMENTS & DOMAIN HANDSHAKES</p>               
              <p>All domain handshakes, local port mappings, and external proxies configured on custom server points are operated under strict local sandbox policies. QUANTUMPLAYERAI delivers services "as-is" without secondary liabilities.</p>             
            </div>             
            <button               
              onClick={() => setCurrentView("landing")}               
              className="mt-4 px-6 py-2.5 rounded-xl font-sans text-[10px] font-semibold tracking-widest text-center uppercase cursor-pointer select-none bg-slate-900 border border-slate-800 hover:border-slate-500 text-slate-300 hover:text-white transition-all transform hover:scale-102 active:scale-95 animate-none"             
            >                 
              Return to Home View             
            </button>           
          </div>           
          <footer className="w-full text-center mt-auto pt-6 text-[9px] font-sans text-slate-500 uppercase tracking-widest">             
            Placeholder Host Domain: https://quantumplayer.ai           
          </footer>         
        </div>       
      )}       
          {(currentView === "player" || currentView === "mymusic" || currentView === "upgrade" || currentView === "ai_enhancement" || currentView === "video") && (         
        <>           
          <main id="main-workbench" className="flex-1 w-full mx-auto px-4 py-6 flex flex-col gap-6 items-stretch max-w-xl">                          
            {currentView === "player" && (
              <>
                <DoubleDinPlayer               
                  currentTrack={currentTrack}               
                  isPlaying={isPlaying}               
                  songProgress={songProgress}               
                  songDuration={songDuration}               
                  volume={volume}               
                  shuffleMode={shuffleMode}               
                  onPlayPause={handlePlayPause}               
                  onStop={handleStop}               
                  onPrev={handlePrevTrack}               
                  onNext={handleNextTrack}               
                  onSeek={handleSeek}               
                  onVolumeChange={setVolume}               
                  onToggleShuffle={() => setShuffleMode(!shuffleMode)}               
                  headunitTime={headunitTime}               
                  isMaxBass={isMaxBass}               
                  onToggleMaxBass={toggleMaxBass}             
                />             

                <section className="flex flex-col gap-6">                              
                  <div className="bg-slate-950/20 p-5 rounded-2xl flex flex-col items-center relative overflow-hidden">                 
                    <div className="absolute top-0 right-0 p-1 bg-red-650 font-sans text-[7px] text-white font-semibold uppercase tracking-widest leading-none rotate-45 translate-x-3.5 translate-y-1 z-10 w-20 text-center select-none shadow animate-pulse">                   
                      WARNING                 
                    </div>                 
                    <h3 className="font-sans text-[11px] font-semibold uppercase tracking-widest text-[#cbd5e1] mb-6 flex items-center gap-1.5 z-10 chrome-text">                   
                      <Activity className="w-3.5 h-3.5 text-blue-500 animate-pulse" />                   
                      Slammer Bass Booster                 
                    </h3>                 
                    <BassKnob value={dspSettings.bassBoost} onChange={handleBassKnobChange} />               
                  </div>               
                  <EqSliders                 
                    gains={dspSettings.eqBands}                 
                    onChange={handleEqValueChange}                 
                    onReset={resetAllFlat}                 
                    presets={[
                      ...BUILTIN_PRESETS,
                      {
                        name: "Custom",
                        eqBands: customEqBands || [0, 0, 0, 0, 0],
                        bassBoost: dspSettings.bassBoost,
                        reverbWet: dspSettings.reverbWet,
                        delayOffsetMs: dspSettings.delayOffsetMs,
                        isPremium: false
                      }
                    ]}                 
                    selectedPresetName={selectedPresetName}                 
                    onPresetSelect={applyAudioPreset}               
                    isPremiumActive={subscriptionTier === "paid"}
                    customEqBands={customEqBands}
                    onSaveCustom={handleSaveCustomPreset}
                    onResetCustom={handleResetCustomPreset}
                  />             
                </section>             
              </>
            )}

            {currentView === "mymusic" && (
              <MyMusicView
                playlist={playlist}
                currentTrackIndex={currentTrackIndex}
                isPlaying={isPlaying}
                currentUser={currentUser}
                isUploading={isUploading}
                uploadProgress={uploadProgress}
                uploadError={uploadError}
                uploadSuccess={uploadSuccess}
                handleFileUpload={handleFileUpload}
                handleCloudFileUpload={handleCloudFileUpload}
                deleteSelectedTracks={deleteSelectedTracks}
                onPlayTrackById={onPlayTrackById}
                setUploadError={setUploadError}
                setUploadSuccess={setUploadSuccess}
              />
            )}

            {currentView === "upgrade" && (
              <UpgradeView 
                onBackToPlayer={() => {
                  setCurrentView("player");
                  setGlobalPremiumPrompt("");
                }} 
                subscriptionTier={subscriptionTier}
                onChangeSubscriptionTier={handleSubscriptionTierChange}
                globalPremiumPrompt={globalPremiumPrompt}
              />
            )}

            {currentView === "ai_enhancement" && (
              <AiEnhancementView
                vehicleInfo={vehicleInfo}
                setVehicleInfo={setVehicleInfo}
                dspSettings={dspSettings}
                handleAiOptimize={handleAiOptimize}
                isOptimizing={isOptimizing}
                subscriptionTier={subscriptionTier}
                onBackToPlayer={() => {
                  setCurrentView("player");
                }}
              />
            )}

            {currentView === "video" && (
              <VideoView
                subscriptionTier={subscriptionTier}
                headunitTime={headunitTime}
                onBackToPlayer={() => {
                  setCurrentView("player");
                }}
                currentUser={currentUser}
              />
            )}
          </main>         
        </>       
      )}     
        </>
      )}

      {/* Persistent Floating Minimized Music Player */}
      {isAppBackgrounded && isPlaying && currentTrack && !isMinimizedClosed && (
        <div 
          id="minimized-persistent-dock"
          className="fixed bottom-4 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:max-w-xl z-[2000] bg-[#070b19]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-4 duration-300"
        >
          <div className="flex items-center justify-between gap-3">
            {/* Clickable Area to Return to Full Player */}
            <div 
              id="minimized-track-info"
              onClick={() => setCurrentView("player")}
              className="flex items-center gap-3 cursor-pointer min-w-0 flex-1 group"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-950/60 border border-white/5 flex items-center justify-center flex-shrink-0 relative overflow-hidden group-hover:border-white/20 transition-all">
                <Music className={`w-4.5 h-4.5 text-slate-400 group-hover:text-emerald-400 transition-colors ${isPlaying ? "animate-pulse" : ""}`} />
                {isPlaying && (
                  <div className="absolute inset-0 bg-emerald-500/10 flex items-end justify-center gap-0.5 pb-1.5">
                    <span className="w-0.5 bg-emerald-400 animate-[bounce_1s_infinite_100ms] rounded-full" style={{ height: '40%' }}></span>
                    <span className="w-0.5 bg-emerald-400 animate-[bounce_1s_infinite_300ms] rounded-full" style={{ height: '70%' }}></span>
                    <span className="w-0.5 bg-emerald-400 animate-[bounce_1s_infinite_200ms] rounded-full" style={{ height: '30%' }}></span>
                  </div>
                )}
              </div>
              <div className="flex flex-col min-w-0 text-left">
                <span className="text-xs font-semibold text-white truncate font-sans group-hover:text-emerald-400 transition-all">
                  {currentTrack.name}
                </span>
                <span className="text-[10px] text-slate-400 truncate font-sans font-light mt-0.5">
                  {currentTrack.artist || "Unknown Artist"}
                </span>
              </div>
            </div>

            {/* Playback Controls */}
            <div className="flex items-center gap-1.5" id="minimized-playback-controls">
              <button
                id="minimized-prev-btn"
                onClick={(e) => { e.stopPropagation(); handlePrevTrack(); }}
                className="p-2 rounded-xl bg-white/[0.02] hover:bg-white/10 text-slate-350 hover:text-white border border-white/5 transition-all active:scale-95 cursor-pointer"
                title="Previous Track"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>
              
              <button
                id="minimized-play-pause-btn"
                onClick={(e) => { e.stopPropagation(); handlePlayPause(); }}
                className="p-2.5 rounded-xl bg-white hover:bg-slate-200 text-stone-950 transition-all active:scale-90 hover:shadow-[0_0_12px_rgba(255,255,255,0.4)] cursor-pointer flex items-center justify-center"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              </button>

              <button
                id="minimized-next-btn"
                onClick={(e) => { e.stopPropagation(); handleNextTrack(); }}
                className="p-2 rounded-xl bg-white/[0.02] hover:bg-white/10 text-slate-350 hover:text-white border border-white/5 transition-all active:scale-95 cursor-pointer"
                title="Next Track"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Close/Dismiss Button with separator */}
            <div className="border-l border-white/10 pl-2 ml-0.5" id="minimized-dismiss-wrapper">
              <button
                id="minimized-dismiss-btn"
                onClick={handleCloseMinimized}
                className="p-2 rounded-xl bg-white/[0.01] hover:bg-red-500/10 text-slate-455 hover:text-red-400 border border-white/5 hover:border-red-500/20 transition-all active:scale-95 cursor-pointer"
                title="Exit Player"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Inline Micro Progress Bar */}
          <div className="w-full h-1 bg-white/[0.04] rounded-full overflow-hidden mt-1 relative" id="minimized-progress-container">
            <div 
              id="minimized-progress-bar"
              className="h-full bg-gradient-to-r from-emerald-500 to-white shadow-[0_0_6px_rgba(255,255,255,0.5)] transition-all duration-300 rounded-full"
              style={{ width: `${songDuration ? (songProgress / songDuration) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}
    </div>   
  ); 
}
