import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  Sparkles, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize2, 
  Upload, 
  Cpu, 
  Activity, 
  Layers, 
  SlidersHorizontal, 
  Clock, 
  ArrowLeft, 
  Video, 
  Monitor, 
  Eye, 
  Square, 
  SkipForward, 
  SkipBack,
  Trash2,
  CheckSquare,
  ChevronRight,
  ChevronDown,
  Search,
  Check,
  FolderSync,
  HardDrive,
  Film,
  User,
  RotateCcw,
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  onSnapshot 
} from "firebase/firestore";
import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL 
} from "firebase/storage";
import { db, storage, auth } from "../firebase";
import { storeVideoBlob, getVideoBlob, deleteVideoBlob } from "../utils/videoStorage";
import { VideoTrack } from "../types";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("firestore-error", { detail: errInfo }));
  }

  throw new Error(JSON.stringify(errInfo));
}

const BUILTIN_VIDEOS: VideoTrack[] = [
  {
    id: "sample-1",
    name: "Big Buck Bunny",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    duration: "9:56",
    creator: "Blender Foundation",
    category: "Cinematic",
    thumbnail: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500&auto=format&fit=crop&q=80",
  },
  {
    id: "sample-2",
    name: "Elephants Dream",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    duration: "10:53",
    creator: "Blender Foundation",
    category: "Futuristic",
    thumbnail: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=500&auto=format&fit=crop&q=80",
  },
  {
    id: "sample-3",
    name: "For Bigger Blazes",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    duration: "0:15",
    creator: "Google Developer",
    category: "Cinematic",
    thumbnail: "https://images.unsplash.com/photo-1518173946687-a4c8a383392e?w=500&auto=format&fit=crop&q=80",
  },
  {
    id: "sample-4",
    name: "For Bigger Escapes",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    duration: "0:15",
    creator: "Google Developer",
    category: "Futuristic",
    thumbnail: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500&auto=format&fit=crop&q=80",
  }
];

interface VideoViewProps {
  subscriptionTier: "free" | "paid";
  headunitTime: string;
  onBackToPlayer: () => void;
  currentUser?: any;
  firestoreVideos?: VideoTrack[];
  isUploading?: boolean;
  uploadProgress?: number | null;
  uploadError?: string;
  uploadSuccess?: string;
  onUploadVideos?: (eOrFiles: any) => Promise<void>;
  
  // Shared states
  selectedVideo: VideoTrack | null;
  setSelectedVideo: (video: VideoTrack | null) => void;
  activeModel: "quantum-scale" | "deep-cinema" | "chroma-hdr";
  setActiveModel: (model: "quantum-scale" | "deep-cinema" | "chroma-hdr") => void;
  upscaleTarget: "HD" | "2K" | "4K" | "8K";
  setUpscaleTarget: (target: "HD" | "2K" | "4K" | "8K") => void;
  colorEnhancement: "hdr" | "vivid" | "lowlight" | "crisp" | "none";
  setColorEnhancement: (color: "hdr" | "vivid" | "lowlight" | "crisp" | "none") => void;
  smoothMotion: boolean;
  setSmoothMotion: (active: boolean) => void;
  turboMode: boolean;
  setTurboMode: (active: boolean) => void;
  aiOptimizedFilters: {
    brightness: number;
    contrast: number;
    saturation: number;
    sharpness: number;
    hueRotate: number;
    sepia: number;
    justification: string;
  } | null;
  setAiOptimizedFilters: (filters: any) => void;
  onRefreshVideos?: () => Promise<void>;
}

export const VideoView: React.FC<VideoViewProps> = ({
  subscriptionTier,
  headunitTime,
  onBackToPlayer,
  currentUser,
  firestoreVideos: parentFirestoreVideos,
  isUploading: parentIsUploading,
  uploadProgress: parentUploadProgress,
  uploadError: parentUploadError,
  uploadSuccess: parentUploadSuccess,
  onUploadVideos,
  onRefreshVideos,
  
  // Shared states
  selectedVideo,
  setSelectedVideo,
  activeModel,
  setActiveModel,
  upscaleTarget,
  setUpscaleTarget,
  colorEnhancement,
  setColorEnhancement,
  smoothMotion,
  setSmoothMotion,
  turboMode,
  setTurboMode,
  aiOptimizedFilters,
  setAiOptimizedFilters
}) => {
  // Video Sources State
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState<string>("");
  const localVideoUrlsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    let objectUrlToCleanup: string | null = null;
    let isCurrent = true;

    const resolveUrl = async () => {
      if (!selectedVideo) {
        setResolvedVideoUrl("");
        return;
      }
      const url = selectedVideo.url;
      if (url && url.startsWith("local-db://")) {
        const id = url.replace("local-db://", "");
        
        // Check in-memory cache first
        if (localVideoUrlsRef.current[id]) {
          setResolvedVideoUrl(localVideoUrlsRef.current[id]);
          return;
        }

        try {
          const blob = await getVideoBlob(id);
          if (blob && isCurrent) {
            const objUrl = URL.createObjectURL(blob);
            objectUrlToCleanup = objUrl;
            localVideoUrlsRef.current[id] = objUrl;
            setResolvedVideoUrl(objUrl);
            return;
          }
        } catch (err) {
          console.error("Failed to load local video blob:", err);
        }
      }
      
      if (isCurrent) {
        setResolvedVideoUrl(url);
      }
    };

    resolveUrl();

    return () => {
      isCurrent = false;
      if (objectUrlToCleanup) {
        URL.revokeObjectURL(objectUrlToCleanup);
      }
    };
  }, [selectedVideo]);

  const [customVideoUrl, setCustomVideoUrl] = useState<string | null>(null);
  const [customVideoName, setCustomVideoName] = useState<string>("");
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Full Video Sync & Locker State
  const [uploadedVideos, setUploadedVideos] = useState<VideoTrack[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [viewCategory, setViewCategory] = useState<"all" | "personal" | "futuristic" | "cinematic" | "abstract">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Firestore sync effect for personal videos
  useEffect(() => {
    if (!currentUser) {
      setUploadedVideos([]);
      return;
    }
    const videosQuery = query(collection(db, "videos"), where("uid", "==", currentUser.uid));
    const unsubscribe = onSnapshot(videosQuery, (snapshot) => {
      const list: VideoTrack[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          name: data.name || "Cloud Video",
          url: data.url,
          duration: data.duration || "0:15",
          creator: data.creator || "Personal Upload",
          category: data.category || "Personal Video",
          thumbnail: data.thumbnail || "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500&auto=format&fit=crop&q=80",
        });
      });
      setUploadedVideos(list);
    }, (error) => {
      console.error("Failed to fetch custom uploaded videos:", error);
      try {
        handleFirestoreError(error, OperationType.LIST, "videos");
      } catch (wrappedErr) {
        // Log to let developers and tools inspect, but don't crash app rendering completely if handled
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Sync with parent-passed props for Firebase integrations if available
  useEffect(() => {
    if (parentFirestoreVideos !== undefined) {
      setUploadedVideos(parentFirestoreVideos);
    }
  }, [parentFirestoreVideos]);

  useEffect(() => {
    if (parentIsUploading !== undefined) {
      setIsUploading(parentIsUploading);
    }
  }, [parentIsUploading]);

  useEffect(() => {
    if (parentUploadProgress !== undefined) {
      setUploadProgress(parentUploadProgress);
    }
  }, [parentUploadProgress]);

  useEffect(() => {
    if (parentUploadSuccess !== undefined) {
      setUploadSuccess(parentUploadSuccess);
    }
  }, [parentUploadSuccess]);

  useEffect(() => {
    if (parentUploadError !== undefined) {
      setUploadError(parentUploadError);
    }
  }, [parentUploadError]);

  // Auto-select first video from combined library if none is currently selected
  useEffect(() => {
    const allVids = [...BUILTIN_VIDEOS, ...uploadedVideos];
    if (!selectedVideo && allVids.length > 0) {
      setSelectedVideo(allVids[0]);
    }
  }, [uploadedVideos, selectedVideo]);

  // Combined and filtered lists
  const allVideosCombined = useMemo(() => {
    return [...BUILTIN_VIDEOS, ...uploadedVideos];
  }, [uploadedVideos]);

  const filteredVideos = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let base = allVideosCombined;

    if (viewCategory === "personal") {
      base = uploadedVideos;
    } else if (viewCategory !== "all") {
      base = allVideosCombined.filter(v => v.category.toLowerCase() === viewCategory.toLowerCase());
    }

    if (!q) return base;
    return base.filter(
      v =>
        v.name.toLowerCase().includes(q) ||
        v.creator.toLowerCase().includes(q) ||
        v.category.toLowerCase().includes(q)
    );
  }, [allVideosCombined, uploadedVideos, viewCategory, searchQuery]);

  // Video Player Reference
  const videoRawRef = useRef<HTMLVideoElement>(null);

  // Interface State Machine
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "21:9" | "4:3" | "1:1">("16:9");

  // File Uploader
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState("");

  // Reset players state cleanly on video track change
  useEffect(() => {
    const raw = videoRawRef.current;
    if (raw) {
      raw.pause();
      raw.load();
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    }
    setAiOptimizedFilters(null);
  }, [selectedVideo]);

  // Synchronizer Event Hooks
  useEffect(() => {
    const raw = videoRawRef.current;
    if (!raw) return;

    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    raw.addEventListener("play", handlePlay);
    raw.addEventListener("pause", handlePause);

    return () => {
      raw.removeEventListener("play", handlePlay);
      raw.removeEventListener("pause", handlePause);
    };
  }, [selectedVideo, customVideoUrl]);

  // Audio mute/unmute and volume bindings
  useEffect(() => {
    const raw = videoRawRef.current;
    if (raw) raw.volume = isMuted ? 0 : volume;
  }, [volume, isMuted, selectedVideo, customVideoUrl]);

  // Speed binding
  useEffect(() => {
    const raw = videoRawRef.current;
    if (raw) raw.playbackRate = playbackSpeed;
  }, [playbackSpeed, selectedVideo, customVideoUrl]);

  // Play Pause Core Loop
  const handlePlayPause = () => {
    const raw = videoRawRef.current;
    if (!raw) return;

    if (isPlaying) {
      raw.pause();
      setIsPlaying(false);
    } else {
      raw.play().catch(e => console.log("Standard playback initialization issue:", e));
      setIsPlaying(true);
    }
  };

  // Forced Reset Button behavior
  const handleStop = () => {
    const raw = videoRawRef.current;
    if (raw) {
      raw.pause();
      raw.currentTime = 0;
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    }
  };

  // Track progress and update
  const handleTimeUpdate = () => {
    const raw = videoRawRef.current;
    if (!raw) return;
    setCurrentTime(raw.currentTime);
    setProgress(raw.duration ? (raw.currentTime / raw.duration) * 100 : 0);
  };

  const handleLoadedMetadata = () => {
    const raw = videoRawRef.current;
    if (raw) {
      setDuration(raw.duration || 0);
    }
  };

  // Handle Seek Interaction
  const handleSeek = (percentage: number) => {
    const raw = videoRawRef.current;
    if (!raw || !raw.duration || isNaN(raw.duration)) return;

    const targetTime = (percentage / 100) * raw.duration;
    raw.currentTime = targetTime;
    setProgress(percentage);
    setCurrentTime(targetTime);
  };

  // Playlist Navigation
  const handleNextVideo = () => {
    if (allVideosCombined.length === 0 || !selectedVideo) return;
    const currentIndex = allVideosCombined.findIndex(v => v.id === selectedVideo.id);
    if (currentIndex !== -1) {
      const nextIndex = (currentIndex + 1) % allVideosCombined.length;
      setCustomVideoUrl(null);
      setSelectedVideo(allVideosCombined[nextIndex]);
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    }
  };

  const handlePrevVideo = () => {
    if (allVideosCombined.length === 0 || !selectedVideo) return;
    const currentIndex = allVideosCombined.findIndex(v => v.id === selectedVideo.id);
    if (currentIndex !== -1) {
      const prevIndex = (currentIndex - 1 + allVideosCombined.length) % allVideosCombined.length;
      setCustomVideoUrl(null);
      setSelectedVideo(allVideosCombined[prevIndex]);
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    }
  };

  // Video Upload Handler
  // Video Ingestion & Sync Cloud Handlers
  const handleLocalVideoUpload = async (
    eOrFiles: React.ChangeEvent<HTMLInputElement> | File[], 
    isCloudSync: boolean = false
  ) => {
    let files: File[] = [];
    if (Array.isArray(eOrFiles)) {
      files = eOrFiles;
    } else {
      if (!eOrFiles.target.files) return;
      files = Array.from(eOrFiles.target.files);
    }
    if (files.length === 0) return;

    if (onUploadVideos) {
      await onUploadVideos(files);
    }
  };

  const toggleSelectVideo = (videoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedVideoIds(prev => 
      prev.includes(videoId) ? prev.filter(id => id !== videoId) : [...prev, videoId]
    );
  };

  const handleBatchDelete = async () => {
    if (selectedVideoIds.length === 0) return;
    if (confirm(`Are you sure you want to delete ${selectedVideoIds.length} video(s) from your storage?`)) {
      const idsToDelete = [...selectedVideoIds];
      setSelectedVideoIds([]);
      try {
        for (const cid of idsToDelete) {
          const track = uploadedVideos.find(v => v.id === cid);
          if (track && track.url.startsWith("local-db://")) {
            const blobId = track.url.replace("local-db://", "");
            await deleteVideoBlob(blobId);
          } else {
            await deleteVideoBlob(cid);
          }
        }
        
        if (onRefreshVideos) {
          await onRefreshVideos();
        }

        setUploadSuccess("Selected video(s) deleted successfully.");
        setTimeout(() => setUploadSuccess(""), 4000);
      } catch (err: any) {
        console.error("Batch delete failed:", err);
        setUploadError("Failed to delete some selected videos from local storage.");
      }
    }
  };

  const triggerUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const formatTimeHelper = (secs: number) => {
    if (isNaN(secs) || secs < 0) return "00:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Fullscreen helper
  const playerWrapperRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenOverlay, setShowFullscreenOverlay] = useState(false);

  const toggleFullscreen = () => {
    if (!playerWrapperRef.current) return;

    if (!document.fullscreenElement) {
      playerWrapperRef.current.requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(err => console.error("Fullscreen blocked:", err));
    } else {
      document.exitFullscreen()
        .then(() => {
          setIsFullscreen(false);
          setShowFullscreenOverlay(false);
        })
        .catch(err => console.error("Exit fullscreen blocked:", err));
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);
      if (!active) {
        setShowFullscreenOverlay(false);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Compute CSS filter enhancements matching the core dynamic profiles
  const enhancedStyles = useMemo(() => {
    if (aiOptimizedFilters) {
      const { brightness, contrast, saturation, sharpness, hueRotate, sepia } = aiOptimizedFilters;
      let filterStr = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation}) hue-rotate(${hueRotate}deg) sepia(${sepia})`;
      
      const sharpnessEffect = sharpness > 0 
        ? `drop-shadow(0 0 ${sharpness * 0.05}px rgba(255,255,255,${sharpness * 0.003}))`
        : "";
        
      return {
        filter: `${filterStr} ${sharpnessEffect}`
      };
    }

    let filterStr = "contrast(1.08) saturate(1.12)";
    
    if (colorEnhancement === "hdr") {
      filterStr = "contrast(1.24) saturate(1.35) brightness(1.08)";
    } else if (colorEnhancement === "vivid") {
      filterStr = "contrast(1.32) saturate(1.60) brightness(1.04)";
    } else if (colorEnhancement === "lowlight") {
      filterStr = "brightness(1.30) contrast(1.15) saturate(0.95)";
    } else if (colorEnhancement === "crisp") {
      filterStr = "contrast(1.18) saturate(1.05) brightness(0.98)";
    } else if (colorEnhancement === "none") {
      filterStr = "none";
    }

    if (turboMode) {
      filterStr += " brightness(1.05) contrast(1.08)";
    }

    // Apply high fidelity 4K sharpening style simulation
    const sharpnessEffect = upscaleTarget === "4K" || upscaleTarget === "8K"
      ? "drop-shadow(0 0 1px rgba(255,255,255,0.15)) contrast(1.02)"
      : "";

    return {
      filter: `${filterStr} ${sharpnessEffect}`
    };
  }, [colorEnhancement, upscaleTarget, turboMode, aiOptimizedFilters]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files) as File[];
      const videoFiles = files.filter(f => f.type.startsWith("video/"));
      if (videoFiles.length > 0) {
        await handleLocalVideoUpload(videoFiles);
      } else {
        setUploadError("No valid video files were dropped. Please drop standard video formats.");
      }
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-full flex flex-col gap-6 select-none transition-all duration-300 ${
        isDraggingOver ? "scale-[0.99] brightness-110" : ""
      }`}
    >
      {/* DOUBLE-DIN CABINET HOUSING - MATCHES MUSIC PLAYER DIMENSIONS EXACTLY */}
      <div 
        id="double-din-video-cabinet"
        className={`w-full rounded-3xl bg-gradient-to-b from-[#140e0d] to-[#0a0504] border p-5 md:p-6 relative overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.9),0_0_30px_rgba(255,255,255,0.05)] high-gloss-reflection transition-all duration-300 ${
          isDraggingOver ? "border-stone-400 shadow-[0_0_40px_rgba(255,255,255,0.15)]" : "border-white/20"
        }`}
      >
        {/* Drag Over Active Overlay */}
        {isDraggingOver && (
          <div className="absolute inset-0 bg-stone-950/95 z-50 flex flex-col items-center justify-center border-4 border-dashed border-stone-800 rounded-3xl p-6">
            <Upload className="w-8 h-8 text-stone-300 mb-3 animate-bounce" />
            <p className="font-sans font-bold text-[11px] text-white uppercase tracking-widest text-center">
              Drop Video Files to Ingest
            </p>
            <p className="font-sans text-[8px] text-stone-500 mt-1.5 text-center uppercase tracking-wider">
              Zero-lag offline playback & cloud syncing will begin instantly
            </p>
          </div>
        )}

        {/* Subtle decorative glowing background accents */}
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-white/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-[#991b1b]/5 rounded-full blur-[100px] pointer-events-none" />

        {/* TOP DECK HEADER: Subtle metadata line that matches the music player */}
        <div className="w-full flex items-center justify-between text-[9px] font-sans tracking-widest text-stone-400 uppercase border-b border-stone-900/60 pb-3 mb-5 relative z-10">
          <span className="flex items-center gap-1.5 text-stone-300 font-semibold">
            <span className="relative flex h-1.5 w-1.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75 ${isPlaying ? "block" : "hidden"}`}></span>
              <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isPlaying ? "bg-white" : "bg-stone-600"}`}></span>
            </span>
          </span>
          
          <button 
            onClick={onBackToPlayer}
            className="px-2.5 py-1 rounded bg-stone-900 hover:bg-stone-850 text-stone-300 hover:text-white border border-stone-800 text-[8px] font-sans font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all active:scale-95"
            title="Return to music player"
          >
            <ArrowLeft className="w-3 h-3" />
            Switch to Audio Player
          </button>

          <div className="flex items-center gap-3">
            {turboMode && (
              <span className="text-red-500 font-semibold animate-pulse bg-red-950/45 px-1.5 py-0.5 rounded border border-red-800/35 animate-none">
                AI TURBO ACTIVE
              </span>
            )}
            <span className="font-semibold text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.45)]">{headunitTime}</span>
          </div>
        </div>

        {/* SINGLE-COLUMN VERTICAL COHESIVE LAYOUT */}
        <div className="flex flex-col gap-5 relative z-10 w-full">
          
          {/* 1. LARGE PREMIUM SCREEN BEZEL DESIGN: Framed just like a double-din physical display screen */}
          <div 
            ref={playerWrapperRef}
            onClick={() => {
              if (isFullscreen) {
                setShowFullscreenOverlay(!showFullscreenOverlay);
              }
            }}
            className={`relative overflow-hidden bg-black flex items-center justify-center select-none transition-all duration-300 ${
              isFullscreen 
                ? "w-screen h-screen max-w-none max-h-none rounded-none border-none cursor-pointer" 
                : `rounded-2xl border border-stone-800 w-full ${
                    aspectRatio === "16:9" ? "aspect-video" : 
                    aspectRatio === "21:9" ? "aspect-[21/9]" : 
                    aspectRatio === "4:3" ? "aspect-[4/3]" : "aspect-square"
                  } shadow-[0_15px_45px_rgba(0,0,0,0.85)]`
            }`}
          >
            {/* High Performance AI Enhanced Video Player */}
            <div className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden">
              {selectedVideo ? (
                <video
                  ref={videoRawRef}
                  src={resolvedVideoUrl || undefined}
                  loop
                  muted={isMuted}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  style={enhancedStyles}
                  className="absolute inset-0 w-full h-full object-cover"
                  playsInline
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center text-stone-400 gap-3 w-full h-full bg-stone-950">
                  <div className="w-14 h-14 rounded-full bg-[#140e0d]/80 border border-stone-850 flex items-center justify-center text-stone-500 shadow-inner">
                    <Film className="w-6 h-6" />
                  </div>
                  <div className="flex flex-col items-center">
                    <h3 className="text-xs font-sans font-bold text-white uppercase tracking-wider">No Video Loaded</h3>
                    <p className="text-[9px] text-stone-500 font-sans mt-1 max-w-xs leading-relaxed">
                      Your personal library is empty. Please upload some videos below to play and enhance them anytime.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Interactive play button overlay when paused */}
            {!isFullscreen && (
              <div 
                onClick={handlePlayPause}
                className="absolute inset-0 bg-transparent flex items-center justify-center cursor-pointer group z-10"
              >
                {!isPlaying && (
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-14 h-14 rounded-full bg-[#140e0d]/90 border border-white/20 text-white flex items-center justify-center shadow-2xl transition-all duration-100 group-hover:scale-110 shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                  >
                    <Play className="w-5 h-5 text-white fill-white translate-x-0.5" />
                  </motion.div>
                )}
              </div>
            )}

            {/* Fullscreen Return Tap Overlay */}
            {isFullscreen && showFullscreenOverlay && (
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFullscreenOverlay(false); // Clicking outside the button closes the overlay
                }}
                className="absolute inset-0 bg-black/30 flex items-center justify-center cursor-pointer z-50 backdrop-blur-xs"
              >
                <div 
                  onClick={(e) => {
                    e.stopPropagation(); // Avoid closing the overlay before execution
                    toggleFullscreen();
                  }}
                  className="group p-5 rounded-full bg-stone-950/80 border border-white/20 text-white shadow-2xl transition-all duration-150 hover:scale-110 shadow-[0_0_20px_rgba(255,255,255,0.25)] flex flex-col items-center gap-1.5 cursor-pointer"
                >
                  <Maximize className="w-8 h-8 text-white" />
                  <span className="text-[8px] font-sans font-extrabold uppercase tracking-widest text-slate-250">
                    Original Size
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 2. TRACK METADATA INFO: Matches Music Player's size and typographic hierarchy exactly */}
          <div className="w-full flex flex-col justify-center items-center text-center px-2 min-w-0">
            <AnimatePresence mode="wait">
              {selectedVideo ? (
                <motion.div
                  key={selectedVideo.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="w-full flex flex-col items-center"
                >
                  <span className="text-[9px] font-sans font-semibold tracking-[0.25em] text-slate-300 uppercase mb-1.5">
                    NOW SCREENING
                  </span>

                  {/* Video Title */}
                  <h2 className="text-xl sm:text-2xl font-sans font-semibold text-white tracking-normal leading-tight truncate max-w-full uppercase drop-shadow-[0_2px_10px_rgba(255,255,255,0.05)]">
                    {selectedVideo.name}
                  </h2>

                  {/* Creator Label */}
                  <p className="text-xs sm:text-sm text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.4)] font-sans font-semibold tracking-widest uppercase mt-1.5">
                    {selectedVideo.creator}
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="no-video-screening"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="w-full flex flex-col items-center text-stone-500 py-2"
                >
                  <span className="text-[9px] font-sans font-semibold tracking-[0.25em] text-stone-600 uppercase mb-1.5">
                    NO ACTIVE MEDIA
                  </span>
                  <h2 className="text-xs font-sans font-bold text-stone-400 uppercase tracking-wider">
                    Locker Empty
                  </h2>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 3. INTEGRATED SEEK BAR & TIME DECK: Matches Double Din Player timeline exactly */}
          <div className="w-full flex flex-col gap-1.5 bg-black/35 p-3 rounded-2xl border border-stone-900/85">
            <div className="flex items-center justify-between text-[10px] font-sans text-stone-400 font-semibold tracking-wider px-1">
              <span className="text-stone-100">{formatTimeHelper(currentTime)}</span>
              <div className="h-[1px] flex-1 mx-3 bg-stone-900/40" />
              <span className="text-slate-200">{formatTimeHelper(duration)}</span>
            </div>

            <div 
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = (e.clientX - rect.left) / rect.width;
                handleSeek(ratio * 100);
              }}
              className="h-2 rounded-full relative cursor-pointer bg-stone-900/90 group transition-all"
            >
              {/* Highlight Progress fill */}
              <div 
                className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-slate-400 via-white to-slate-350 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.7)] transition-all"
                style={{ width: `${progress}%` }}
              />
              {/* Seeking handle thumb */}
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full border-2 border-slate-300 shadow-[0_2px_4px_rgba(0,0,0,0.6)] scale-100 opacity-90 hover:scale-125 transition-transform"
                style={{ left: `calc(${progress}% - 6px)` }}
              />
            </div>
          </div>

          {/* 4. METALLIC DIGITAL CONTROL DECK: Centered circular buttons in physical layout */}
          <div className="flex items-center justify-between gap-4 mt-1 w-full px-1">
            
            {/* DECORATIVE MEDIA INDICATOR */}
            <div className="w-9 h-9 rounded-full border border-stone-900 bg-stone-950/45 flex items-center justify-center text-stone-600 select-none">
              <Film className="w-4 h-4 animate-pulse" />
            </div>

            {/* PREVIOUS VIDEO LOOP (SkipBack) */}
            <button
              onClick={handlePrevVideo}
              disabled={!selectedVideo}
              className="w-10 h-10 rounded-full border border-stone-850 bg-transparent flex items-center justify-center text-stone-300 hover:text-white hover:border-stone-450 active:scale-90 disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer"
              title="Previous Video Loop"
            >
              <SkipBack className="w-4.5 h-4.5" />
            </button>

            {/* CENTRAL PRIMARY PLAY / PAUSE SPIN BUTTON (Big metallic wheel button) */}
            <button
              onClick={handlePlayPause}
              disabled={!selectedVideo}
              className="w-14 h-14 rounded-full bg-gradient-to-br from-white via-slate-100 to-slate-400 p-0.5 border-2 border-slate-300 shadow-[0_0_24px_rgba(255,255,255,0.45)] cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all text-stone-950 flex items-center justify-center"
              title={isPlaying ? "Pause Video" : "Play Video"}
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 text-stone-900 fill-stone-900" />
              ) : (
                <Play className="w-6 h-6 text-stone-900 fill-stone-900 ml-0.5" />
              )}
            </button>

            {/* NEXT VIDEO LOOP (SkipForward) */}
            <button
              onClick={handleNextVideo}
              disabled={!selectedVideo}
              className="w-10 h-10 rounded-full border border-stone-850 bg-transparent flex items-center justify-center text-stone-300 hover:text-white hover:border-stone-450 active:scale-90 disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer"
              title="Next Video Loop"
            >
              <SkipForward className="w-4.5 h-4.5" />
            </button>

            {/* RESET / STOP BUTTON */}
            <button
              onClick={handleStop}
              disabled={!selectedVideo}
              className="w-9 h-9 rounded-full border border-stone-850 bg-transparent flex items-center justify-center text-red-500 hover:text-red-400 hover:border-red-950/65 active:scale-90 disabled:opacity-25 disabled:pointer-events-none transition-all cursor-pointer"
              title="Stop Video & Reset"
            >
              <Square className="w-3.5 h-3.5 fill-red-800/10" />
            </button>

            {/* FULL SCREEN TOGGLE */}
            <button
              onClick={toggleFullscreen}
              disabled={!selectedVideo}
              className={`w-9 h-9 rounded-full border flex items-center justify-center cursor-pointer transition-all disabled:opacity-20 disabled:pointer-events-none ${
                isFullscreen
                  ? "bg-white/10 border-slate-350 text-white shadow-[0_0_12px_rgba(255,255,255,0.45)]"
                  : "bg-transparent border-stone-850 hover:border-stone-500 text-stone-300 hover:text-white"
              }`}
              title="Toggle Full Screen"
            >
              <Maximize className="w-4 h-4" />
            </button>
          </div>

          {/* 5. HORIZONTAL VOLUME SLIDER: Complete and matches music player volume deck layout exactly */}
          <div className="w-full mt-2 pt-4 border-t border-stone-900/60 flex items-center gap-3.5 relative select-none">
            
            {/* Volume Mute Toggle */}
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="text-stone-400 hover:text-white transition-all cursor-pointer hover:scale-105"
              title={isMuted ? "Unmute sound" : "Mute sound"}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4.5 h-4.5 text-red-500 animate-pulse" />
              ) : (
                <Volume2 className="w-4.5 h-4.5" />
              )}
            </button>

            {/* Metallic Volume Slider */}
            <div className="flex-1 flex items-center relative">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setVolume(val);
                  if (isMuted && val > 0) setIsMuted(false);
                }}
                className="w-full h-1.5 rounded-lg appearance-none cursor-pointer outline-none bg-stone-900 [&::-webkit-slider-runnable-track]:bg-stone-900 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-white"
                style={{
                  background: `linear-gradient(to right, #e2e8f0 0%, #e2e8f0 ${isMuted ? 0 : volume * 100}%, #1c1917 ${isMuted ? 0 : volume * 100}%, #1c1917 100%)`
                }}
              />
            </div>

            {/* Value Badge */}
            <span className="text-[10px] font-sans font-semibold text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.3)] min-w-[36px] text-right">
              {isMuted ? "MUTED" : `${Math.round(volume * 100)}%`}
            </span>

            {/* DYNAMIC TURBO HDR (Matches BASS MAX switch exactly in looks) */}
            <button
              onClick={() => setTurboMode(!turboMode)}
              className={`px-3 py-1.5 rounded-xl border font-sans text-[9px] font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                turboMode
                  ? "bg-[#4a1515] border-[#991b1b] text-red-100 animate-pulse shadow-[0_0_12px_rgba(153,27,27,0.5)]"
                  : "bg-stone-900 hover:bg-stone-850 border-stone-800 text-stone-400 hover:text-white"
              }`}
              title="Super-charge visual contrast and dynamic brightness"
            >
              💥 TURBO HDR
            </button>
          </div>

          {/* Video Format Controls: Screen aspect ratio and speed */}
          <div className="mt-2 pt-4 border-t border-stone-900/60 flex flex-col gap-4">

            {/* Screen Aspect Ratio & Speed Controls */}
            <div className="grid grid-cols-2 gap-4 pt-1">
              
              {/* Aspect Ratio Picker */}
              <div className="flex flex-col gap-1.5 text-left">
                <span className="font-sans text-[8px] font-bold uppercase tracking-widest text-stone-400">
                  Screen Aspect Ratio
                </span>
                <div className="grid grid-cols-4 gap-1 bg-stone-950/60 p-1 rounded-xl border border-stone-900">
                  {(["16:9", "21:9", "4:3", "1:1"] as const).map((ratio) => (
                    <button
                      key={ratio}
                      onClick={() => setAspectRatio(ratio)}
                      className={`py-1 rounded text-[8px] font-mono font-bold transition-all cursor-pointer ${
                        aspectRatio === ratio
                          ? "bg-stone-850 text-white"
                          : "text-stone-500 hover:text-stone-300"
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>

              {/* Playback speed Selection */}
              <div className="flex flex-col gap-1.5 text-left">
                <span className="font-sans text-[8px] font-bold uppercase tracking-widest text-stone-400">
                  Speed Control
                </span>
                <div className="relative">
                  <select
                    value={playbackSpeed}
                    onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                    className="w-full appearance-none bg-stone-950 hover:bg-stone-900 border border-stone-900 text-stone-300 hover:text-white font-mono text-[9px] font-bold p-2 px-3 pr-7 rounded-xl cursor-pointer outline-none transition-all"
                  >
                    <option value="0.5">0.5x Slow</option>
                    <option value="1">1.0x Normal</option>
                    <option value="1.25">1.25x Fast</option>
                    <option value="1.5">1.5x Turbo</option>
                    <option value="2">2.0x Double</option>
                  </select>
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-stone-500">
                    <Clock className="w-2.5 h-2.5" />
                  </div>
                </div>
              </div>

            </div>

          </div>

          {/* DYNAMIC VIDEO HUB: FULL VIDEO CLOUD LOCKER */}
          <div className="mt-4 pt-6 border-t border-stone-900/60 flex flex-col gap-5">
            
            {/* Header section with Stats */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="text-left">
                <h3 className="font-sans text-[11px] font-bold uppercase tracking-widest text-slate-250 flex items-center gap-1.5">
                  <Film className="w-4 h-4 text-stone-400" />
                  Quantum Video Locker
                </h3>
                <p className="font-sans text-[8px] text-stone-500 tracking-wide uppercase mt-0.5">
                  Manage, upload, and synchronize interactive cabin media & scenic video loops
                </p>
              </div>
              <div className="flex items-center gap-2 self-start md:self-auto bg-stone-950/60 px-3 py-1.5 rounded-xl border border-stone-900">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-300 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-slate-450"></span>
                </span>
                <span className="font-mono text-[9px] font-bold text-stone-400 uppercase tracking-wider">
                  {uploadedVideos.length + BUILTIN_VIDEOS.length} Clips Indexed
                </span>
              </div>
            </div>

            {/* Hub Action Deck (The Ingestion button) */}
            <div className="flex flex-col items-center justify-center">
              <button
                disabled={isUploading}
                onClick={triggerUploadClick}
                className="group relative flex flex-col items-center justify-center p-6 rounded-2xl bg-gradient-to-b from-stone-900 to-[#120c0b] border border-stone-850 hover:border-white/10 transition-all duration-200 shadow-md cursor-pointer hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none w-full"
              >
                <div className="w-8 h-8 rounded-full bg-stone-950 flex items-center justify-center mb-2.5 border border-stone-900 group-hover:border-white/10 transition-colors">
                  <Upload className="w-4 h-4 text-stone-300 group-hover:text-white transition-colors" />
                </div>
                <span className="font-sans text-[10px] font-bold text-stone-200 uppercase tracking-widest group-hover:text-white transition-colors">
                  Open Video File
                </span>
                <span className="font-sans text-[7.5px] text-stone-550 mt-1 uppercase tracking-tight text-center">
                  Directly stream video from your device storage
                </span>
              </button>
            </div>
 
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              multiple
              onChange={(e) => handleLocalVideoUpload(e, false)}
              className="hidden"
            />

            {/* In-Progress Alerts & Notifications */}
            <AnimatePresence>

              {/* Error Alert */}
              {uploadError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-sans text-[9px] text-left uppercase tracking-tight flex items-start gap-2"
                >
                  <span className="font-bold text-[10px] mt-0.5">⚠️</span>
                  <div>{uploadError}</div>
                </motion.div>
              )}

              {/* Success Alert */}
              {uploadSuccess && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-sans text-[9px] text-left uppercase tracking-tight flex items-start gap-2"
                >
                  <span className="font-bold text-[10px] mt-0.5">✓</span>
                  <div>{uploadSuccess}</div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Filtering, Search & Swappers */}
            <div className="flex flex-col gap-3">
              {/* Search Bar */}
              <div className="relative w-full">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500">
                  <Search className="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  placeholder="SEARCH VIDEO LOCKER BY NAME, CATEGORY, CREATOR..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-stone-950 border border-stone-900 rounded-xl font-sans text-[9.5px] font-bold text-stone-300 placeholder-stone-600 focus:outline-none focus:border-stone-700 focus:text-white uppercase transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-white font-sans text-[9px] uppercase font-bold"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Category Tab Selector */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1.5 scrollbar-thin">
                {([
                  { id: "all", label: "All Videos" },
                  { id: "personal", label: "My Locker" },
                  { id: "futuristic", label: "Futuristic" },
                  { id: "cinematic", label: "Cinematic" },
                  { id: "abstract", label: "Abstract" }
                ] as const).map((tab) => {
                  const isSelected = viewCategory === tab.id;
                  const count = tab.id === "all" ? allVideosCombined.length 
                              : tab.id === "personal" ? uploadedVideos.length 
                              : allVideosCombined.filter(v => v.category.toLowerCase() === tab.id).length;

                  return (
                    <button
                      key={tab.id}
                      onClick={() => setViewCategory(tab.id)}
                      className={`px-3 py-1.5 rounded-lg border font-sans text-[8.5px] font-extrabold uppercase tracking-widest whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                        isSelected
                          ? "bg-stone-300 text-stone-950 border-stone-300 font-black shadow-[0_2px_8px_rgba(255,255,255,0.08)]"
                          : "bg-stone-950/60 text-stone-450 border-stone-900 hover:text-stone-300 hover:border-stone-800"
                      }`}
                    >
                      {tab.label}
                      <span className={`text-[7.5px] font-mono px-1 rounded-sm ${isSelected ? "bg-stone-950 text-stone-300" : "bg-stone-900 text-stone-500"}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selection & Dynamic Batch-Deletes Section */}
            {selectedVideoIds.length > 0 && (
              <div className="flex items-center justify-between p-3 rounded-2xl bg-red-950/20 border border-red-900/30">
                <span className="font-sans text-[8.5px] font-bold uppercase tracking-wider text-red-400">
                  {selectedVideoIds.length} video(s) selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedVideoIds([])}
                    className="px-2.5 py-1 rounded bg-stone-900 hover:bg-stone-850 text-stone-400 hover:text-stone-200 border border-stone-800 text-[8px] font-sans font-bold uppercase tracking-wider cursor-pointer"
                  >
                    Deselect All
                  </button>
                  <button
                    onClick={handleBatchDelete}
                    className="px-2.5 py-1 rounded bg-red-950/60 hover:bg-red-900/50 text-red-400 hover:text-red-300 border border-red-900/40 text-[8px] font-sans font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete Selected
                  </button>
                </div>
              </div>
            )}

            {/* Video List Grid Container */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {filteredVideos.map((vid) => {
                const isCustom = !BUILTIN_VIDEOS.some(b => b.id === vid.id);
                const isSelected = selectedVideo?.id === vid.id;
                const isChecked = selectedVideoIds.includes(vid.id);

                return (
                  <div
                    key={vid.id}
                    onClick={() => {
                      setCustomVideoUrl(null);
                      setSelectedVideo(vid);
                      setIsPlaying(false);
                      setProgress(0);
                      setCurrentTime(0);
                    }}
                    className={`group relative text-left rounded-2xl overflow-hidden border p-1 bg-[#140e0d]/50 hover:bg-[#1c1412]/60 transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? "border-slate-350 shadow-[0_0_15px_rgba(255,255,255,0.08)] bg-[#1c1412]/80"
                        : "border-stone-900/60 hover:border-stone-800"
                    }`}
                  >
                    {/* Thumbnail bezel */}
                    <div className="relative aspect-video rounded-xl overflow-hidden mb-2 bg-stone-950">
                      {vid.thumbnail ? (
                        <img 
                          src={vid.thumbnail} 
                          alt="" 
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover transition-all duration-300 group-hover:scale-105" 
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-stone-900 gap-1">
                          <Film className="w-5 h-5 text-stone-600 animate-pulse" />
                          <span className="text-[7px] font-sans font-bold text-stone-500 uppercase tracking-widest">
                            RAW STREAM
                          </span>
                        </div>
                      )}
                      
                      {/* Active Player Glow overlay */}
                      {isSelected && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <span className="p-2 rounded-full bg-white/20 backdrop-blur-md border border-white/35">
                            <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
                          </span>
                        </div>
                      )}

                      {/* Video Category Badge */}
                      <span className="absolute top-1.5 left-1.5 font-sans text-[7px] font-bold text-slate-300 bg-black/60 px-1.5 py-0.5 rounded uppercase tracking-wider">
                        {vid.category}
                      </span>

                      {/* Video Duration */}
                      <span className="absolute bottom-1.5 right-1.5 font-mono text-[7px] text-slate-300 bg-black/75 px-1.5 rounded">
                        {vid.duration}
                      </span>

                      {/* Checkbox for custom uploads */}
                      {isCustom && (
                        <button
                          onClick={(e) => toggleSelectVideo(vid.id, e)}
                          className="absolute top-1.5 right-1.5 p-1 rounded bg-black/60 border border-stone-800 hover:border-white/20 text-stone-400 hover:text-white transition-all"
                        >
                          {isChecked ? (
                            <Check className="w-3.5 h-3.5 text-white" />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-sm border border-stone-450" />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Metadata Content area */}
                    <div className="px-1.5 pb-1.5 flex flex-col justify-between flex-grow">
                      <div>
                        <h4 className="font-sans text-[9px] font-extrabold text-stone-200 truncate group-hover:text-white transition-colors uppercase tracking-tight">
                          {vid.name}
                        </h4>
                        <div className="flex items-center justify-between text-[7.5px] text-stone-500 uppercase tracking-wide mt-1">
                          <span className="truncate max-w-[120px] flex items-center gap-1 font-sans">
                            <User className="w-2.5 h-2.5 text-stone-650" />
                            {vid.creator}
                          </span>
                          {isCustom && (
                            <span className="font-sans text-[7.5px] text-stone-400 bg-stone-900 border border-stone-850 px-1 rounded-sm font-bold">
                              Custom Sync
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </motion.div>
  );
};
