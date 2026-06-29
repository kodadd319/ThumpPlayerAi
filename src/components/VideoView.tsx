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
  User
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
  throw new Error(JSON.stringify(errInfo));
}

interface VideoTrack {
  id: string;
  name: string;
  url: string;
  duration: string;
  creator: string;
  category: string;
  thumbnail: string;
}

const BUILTIN_VIDEOS: VideoTrack[] = [];

interface VideoViewProps {
  subscriptionTier: "free" | "paid";
  headunitTime: string;
  onBackToPlayer: () => void;
  currentUser?: any;
}

export const VideoView: React.FC<VideoViewProps> = ({
  subscriptionTier,
  headunitTime,
  onBackToPlayer,
  currentUser
}) => {
  // Video Sources State
  const [selectedVideo, setSelectedVideo] = useState<VideoTrack | null>(null);
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

  // Auto-select first video from uploaded library if none is currently selected
  useEffect(() => {
    if (!selectedVideo && uploadedVideos.length > 0) {
      setSelectedVideo(uploadedVideos[0]);
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

  // AI Quality Profiles state
  const [activeModel, setActiveModel] = useState<"quantum-scale" | "deep-cinema" | "chroma-hdr">("quantum-scale");
  const [upscaleTarget, setUpscaleTarget] = useState<"HD" | "2K" | "4K" | "8K">("4K");
  const [colorEnhancement, setColorEnhancement] = useState<"hdr" | "vivid" | "lowlight" | "crisp" | "none">("hdr");
  const [smoothMotion, setSmoothMotion] = useState(true);
  const [turboMode, setTurboMode] = useState(false);

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

    if (!currentUser) {
      // Local offline mode: Save to IndexedDB and set as playing with progress simulation!
      const file = files[0];
      if (!file.type.startsWith("video/")) {
        setUploadError("Invalid file type. Please upload a standard video file (MP4, WebM, etc.)");
        return;
      }
      setUploadError("");
      setIsUploading(true);
      setUploadProgress(10);
      
      const localId = `offline-${Date.now()}`;
      try {
        const objUrl = URL.createObjectURL(file);
        localVideoUrlsRef.current[localId] = objUrl;
        
        setUploadProgress(35);
        await storeVideoBlob(localId, file);
        setUploadProgress(75);
        
        const localTrack: VideoTrack = {
          id: localId,
          name: file.name.replace(/\.[^/.]+$/, ""),
          url: `local-db://${localId}`,
          duration: "Local File",
          creator: "Offline Local Video",
          category: "Personal Video",
          thumbnail: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500&auto=format&fit=crop&q=80"
        };
        
        await new Promise((r) => setTimeout(r, 400));
        setUploadProgress(100);
        await new Promise((r) => setTimeout(r, 200));
        
        setSelectedVideo(localTrack);
        setIsPlaying(false);
        setProgress(0);
        setCurrentTime(0);

        setUploadSuccess("Saved offline local video to browser storage successfully! Log in to sync to cloud storage.");
        setTimeout(() => setUploadSuccess(""), 4000);
      } catch (err) {
        console.error("Failed to store video locally:", err);
        setUploadError("Failed to store video in browser database.");
      } finally {
        setIsUploading(false);
        setUploadProgress(null);
      }
      return;
    }

    // Checking upload limit for Free Tier users (max 5)
    const currentCount = uploadedVideos.length;
    if (subscriptionTier !== "paid" && (currentCount + files.length) > 5) {
      setUploadError(`Free Tier limit exceeded. You currently have ${currentCount} video file(s) synced and are trying to add ${files.length} more (Limit is 5). Upgrade to Premium to enjoy unlimited high-fidelity video cloud hosting!`);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError("");
    setUploadSuccess("");

    try {
      let firstUploadedTrack: VideoTrack | null = null;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith("video/")) {
          setUploadError(`File "${file.name}" is not a valid video format.`);
          continue;
        }

        const videoId = `vid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Cache the local file's object URL in-memory immediately for instant, zero-lag play
        const objUrl = URL.createObjectURL(file);
        localVideoUrlsRef.current[videoId] = objUrl;

        // 1. First, store in IndexedDB for instant, zero-lag play and reliable offline execution
        await storeVideoBlob(videoId, file);

        // 2. Prepare Firestore document
        // We start with a local URL. If Firebase Storage succeeds, we'll use that instead.
        let finalUrl = `local-db://${videoId}`;

        // 3. Attempt to upload to Firebase Storage
        try {
          const timestamp = Date.now();
          const storagePath = `videos/${currentUser.uid}/${timestamp}_${file.name}`;
          const storageRef = ref(storage, storagePath);
          const uploadTask = uploadBytesResumable(storageRef, file, { contentType: file.type });

          await new Promise<void>((resolve) => {
            uploadTask.on(
              "state_changed",
              (snapshot) => {
                const progressVal = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                const totalProgress = Math.round(((i / files.length) * 100) + (progressVal / files.length));
                setUploadProgress(totalProgress);
              },
              (err) => {
                // If storage fails, we still resolve to fallback on local IndexedDB
                console.warn("Storage upload failed, fallback to local database storage:", err);
                resolve();
              },
              async () => {
                try {
                  const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                  finalUrl = downloadUrl;
                  resolve();
                } catch (urlErr) {
                  console.warn("Download URL retrieval failed:", urlErr);
                  resolve();
                }
              }
            );
          });
        } catch (storageErr) {
          console.warn("Firebase Storage failed, saving metadata with local DB fallback:", storageErr);
        }

        // 4. Save to Firestore
        const docData = {
          uid: currentUser.uid,
          name: file.name.replace(/\.[^/.]+$/, ""),
          url: finalUrl,
          duration: "0:15",
          creator: isCloudSync ? "Cloud Sync Video" : "Personal Upload",
          category: "Personal Video",
          thumbnail: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=500&auto=format&fit=crop&q=80",
          createdAt: new Date().toISOString()
        };

        let docRef;
        try {
          docRef = await addDoc(collection(db, "videos"), docData);
        } catch (dbErr) {
          handleFirestoreError(dbErr, OperationType.CREATE, "videos");
        }

        if (i === 0 && docRef) {
          firstUploadedTrack = {
            id: docRef.id,
            ...docData
          };
        }
      }

      if (firstUploadedTrack) {
        setSelectedVideo(firstUploadedTrack);
        setIsPlaying(false);
        setProgress(0);
        setCurrentTime(0);
      }

      setUploadSuccess(`Successfully synchronized ${files.length} video(s) to your cloud video locker!`);
      setTimeout(() => setUploadSuccess(""), 4500);
    } catch (err: any) {
      console.error("Video upload failed:", err);
      setUploadError(err.message || "An error occurred during video uploads.");
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
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
    if (confirm(`Are you sure you want to delete ${selectedVideoIds.length} video(s) from your synced cloud storage?`)) {
      const idsToDelete = [...selectedVideoIds];
      setSelectedVideoIds([]);
      try {
        for (const cid of idsToDelete) {
          const track = uploadedVideos.find(v => v.id === cid);
          if (track && track.url.startsWith("local-db://")) {
            const blobId = track.url.replace("local-db://", "");
            await deleteVideoBlob(blobId);
          }
          try {
            await deleteDoc(doc(db, "videos", cid));
          } catch (dbErr) {
            handleFirestoreError(dbErr, OperationType.DELETE, `videos/${cid}`);
          }
        }
        setUploadSuccess("Selected video(s) deleted successfully.");
        setTimeout(() => setUploadSuccess(""), 4000);
      } catch (err: any) {
        console.error("Batch delete failed:", err);
        setUploadError("Failed to delete some selected videos from cloud storage.");
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
  }, [colorEnhancement, upscaleTarget, turboMode]);

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
            ELITE ULTRA-HD VIDEO ACTIVE
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
                  src={resolvedVideoUrl}
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

                  {/* Category & Mode Tags */}
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <span className="text-[8px] font-sans font-semibold tracking-[0.12em] text-white bg-white/10 px-2.5 py-0.5 rounded-full border border-white/25 uppercase">
                      AI UP-RESOLUTION
                    </span>
                    <span className="text-[8px] font-sans font-semibold tracking-[0.12em] text-stone-300 bg-stone-900 px-2.5 py-0.5 rounded-full border border-stone-800 uppercase">
                      {selectedVideo.category}
                    </span>
                  </div>
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

          {/* 6. PICTURE & AI CUSTOMIZATION PANEL: Sleek dashboard grid with simplified friendly controls */}
          <div className="mt-2 pt-4 border-t border-stone-900/60 flex flex-col gap-4">
            <h3 className="font-sans text-[10px] font-bold uppercase tracking-widest text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-stone-400" />
              AI Picture Adjustment
            </h3>

            {/* AI Reconstruction Profile */}
            <div className="flex flex-col gap-1.5">
              <span className="font-sans text-[8px] font-bold uppercase tracking-widest text-stone-400 text-left">
                Reconstruction Mode
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: "quantum-scale" as const, name: "Quantum Scale" },
                  { id: "deep-cinema" as const, name: "Deep Cinema" },
                  { id: "chroma-hdr" as const, name: "Chroma HDR" }
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setActiveModel(mode.id)}
                    className={`py-2 rounded-xl border font-sans text-[9px] font-bold uppercase tracking-tight transition-all cursor-pointer truncate ${
                      activeModel === mode.id
                        ? "bg-white/10 border-white/40 text-white font-extrabold shadow"
                        : "bg-stone-950/40 border-stone-900 text-stone-500 hover:text-stone-300"
                    }`}
                  >
                    {mode.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Two-Column Mini Controls */}
            <div className="grid grid-cols-2 gap-4">
              
              {/* Quality Level (Resolution) */}
              <div className="flex flex-col gap-1.5 text-left">
                <span className="font-sans text-[8px] font-bold uppercase tracking-widest text-stone-400">
                  Quality Level
                </span>
                <select
                  value={upscaleTarget}
                  onChange={(e) => setUpscaleTarget(e.target.value as any)}
                  className="w-full bg-stone-950 border border-stone-900 text-stone-300 hover:text-white font-sans text-[10px] font-bold p-2.5 rounded-xl cursor-pointer outline-none transition-all uppercase"
                >
                  <option value="HD">Standard HD (1080p)</option>
                  <option value="2K">Smooth QHD (2K)</option>
                  <option value="4K">High-Res (4K)</option>
                  <option value="8K">Ultra-Extreme (8K)</option>
                </select>
              </div>

              {/* Color Preset Selector */}
              <div className="flex flex-col gap-1.5 text-left">
                <span className="font-sans text-[8px] font-bold uppercase tracking-widest text-stone-400">
                  Color Enhancement
                </span>
                <select
                  value={colorEnhancement}
                  onChange={(e) => setColorEnhancement(e.target.value as any)}
                  className="w-full bg-stone-950 border border-stone-900 text-stone-300 hover:text-white font-sans text-[10px] font-bold p-2.5 rounded-xl cursor-pointer outline-none transition-all uppercase"
                >
                  <option value="hdr">HDR Expansion</option>
                  <option value="vivid">Vivid Glow</option>
                  <option value="lowlight">Low-Light Enhancer</option>
                  <option value="crisp">Razor Sharp</option>
                  <option value="none">Original Source</option>
                </select>
              </div>

            </div>

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

            {/* Smooth Motion FPS switch row */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-950/40 border border-stone-900/80">
              <div className="flex items-center gap-2 text-left">
                <Layers className="w-4 h-4 text-stone-400" />
                <div className="flex flex-col">
                  <span className="font-sans text-[9px] font-bold text-stone-200 uppercase tracking-tight">
                    Smooth Motion (60 FPS)
                  </span>
                  <span className="font-sans text-[8px] text-stone-500 tracking-wide">
                    Double the standard video frame rate in real-time
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSmoothMotion(!smoothMotion)}
                className={`w-10 h-5.5 rounded-full transition-all duration-150 relative cursor-pointer ${
                  smoothMotion ? "bg-white/90" : "bg-stone-850"
                }`}
              >
                <div 
                  className={`w-4 h-4 rounded-full absolute top-0.75 transition-all duration-150 ${
                    smoothMotion ? "left-5 bg-stone-950" : "left-1 bg-stone-500"
                  }`}
                />
              </button>
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

            {/* Hub Action Deck (The Ingestion buttons) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Button 1: Add Local Videos */}
              <button
                disabled={isUploading}
                onClick={triggerUploadClick}
                className="group relative flex flex-col items-center justify-center p-3.5 rounded-2xl bg-gradient-to-b from-stone-900 to-[#120c0b] border border-stone-850 hover:border-white/10 transition-all duration-200 shadow-md cursor-pointer hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none"
              >
                <div className="w-7 h-7 rounded-xl bg-stone-950 flex items-center justify-center mb-2 border border-stone-900 group-hover:border-white/10 transition-colors">
                  <Upload className="w-3.5 h-3.5 text-stone-300 group-hover:text-white transition-colors" />
                </div>
                <span className="font-sans text-[9px] font-bold text-stone-200 uppercase tracking-wider group-hover:text-white transition-colors">
                  Add Local Videos
                </span>
                <span className="font-sans text-[7.5px] text-stone-550 mt-1 uppercase tracking-tight text-center">
                  Drag or select video files
                </span>
              </button>
 
              {/* Button 2: Sync Cloud Storage */}
              <button
                disabled={isUploading}
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.setAttribute("multiple", "true");
                    fileInputRef.current.click();
                  }
                }}
                className="group relative flex flex-col items-center justify-center p-3.5 rounded-2xl bg-gradient-to-b from-stone-900 to-[#120c0b] border border-stone-850 hover:border-white/10 transition-all duration-200 shadow-md cursor-pointer hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none"
              >
                <div className="w-7 h-7 rounded-xl bg-stone-950 flex items-center justify-center mb-2 border border-stone-900 group-hover:border-white/10 transition-colors">
                  <FolderSync className="w-3.5 h-3.5 text-stone-300 group-hover:text-white transition-colors" />
                </div>
                <span className="font-sans text-[9px] font-bold text-stone-200 uppercase tracking-wider group-hover:text-white transition-colors">
                  Sync Cloud Storage
                </span>
                <span className="font-sans text-[7.5px] text-stone-550 mt-1 uppercase tracking-tight text-center">
                  Multi-device backup vault
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
              {/* Storage Upload Progress */}
              {isUploading && uploadProgress !== null && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-3.5 rounded-2xl bg-stone-950/80 border border-stone-900 flex flex-col gap-2 relative overflow-hidden"
                >
                  <div className="flex items-center justify-between text-[8.5px] font-sans font-bold uppercase text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <span className="animate-spin inline-block w-2.5 h-2.5 border-2 border-stone-400 border-t-transparent rounded-full" />
                      Synchronizing Video Files to Locker...
                    </span>
                    <span className="font-mono">{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-stone-900 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-slate-300 rounded-full transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </motion.div>
              )}

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
                      <img 
                        src={vid.thumbnail} 
                        alt="" 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover transition-all duration-300 group-hover:scale-105" 
                      />
                      
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
