import React, { useState, useMemo } from "react";
import { 
  Music, 
  Upload, 
  Sparkles, 
  Trash2, 
  CheckSquare, 
  Square, 
  ChevronRight, 
  ChevronDown,
  Disc,
  Mic,
  Tag,
  Search,
  Check,
  FolderSync,
  Database,
  Grid
} from "lucide-react";
import { Track } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface MyMusicViewProps {
  playlist: Track[];
  currentTrackIndex: number;
  isPlaying: boolean;
  currentUser: any; // User | null
  isUploading: boolean;
  uploadProgress: number | null;
  uploadError: string;
  uploadSuccess: string;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleCloudFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  deleteSelectedTracks: (trackIds: string[]) => Promise<void>;
  onPlayTrackById: (trackId: string, customQueue?: Track[]) => void;
  setUploadError: (msg: string) => void;
  setUploadSuccess: (msg: string) => void;
}

export const MyMusicView: React.FC<MyMusicViewProps> = ({
  playlist,
  currentTrackIndex,
  isPlaying,
  currentUser,
  isUploading,
  uploadProgress,
  uploadError,
  uploadSuccess,
  handleFileUpload,
  handleCloudFileUpload,
  deleteSelectedTracks,
  onPlayTrackById,
  setUploadError,
  setUploadSuccess
}) => {
  const [viewCategory, setViewCategory] = useState<"all" | "artist" | "album" | "genre">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // 1. Filter out sample/built-in tracks to get user uploaded music
  const uploadedTracks = useMemo(() => {
    return playlist.filter(track => !track.id.startsWith("sample-"));
  }, [playlist]);

  // Determine current active track details if playing from the user's list
  const currentPlayingTrackId = useMemo(() => {
    if (currentTrackIndex >= 0 && currentTrackIndex < playlist.length) {
      return playlist[currentTrackIndex].id;
    }
    return null;
  }, [playlist, currentTrackIndex]);

  // Apply search query filter with broad tolerance
  const filteredTracks = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return uploadedTracks;
    return uploadedTracks.filter(
      t => 
        (t.name || "").toLowerCase().includes(q) ||
        (t.artist || "").toLowerCase().includes(q) ||
        (t.album || "").toLowerCase().includes(q) ||
        (t.genre || "").toLowerCase().includes(q)
    );
  }, [uploadedTracks, searchQuery]);

  // Compute groupings dynamically based on state
  const tracksByArtist = useMemo(() => {
    const groups: Record<string, Track[]> = {};
    filteredTracks.forEach(track => {
      const artist = track.artist || "Unknown Artist";
      if (!groups[artist]) groups[artist] = [];
      groups[artist].push(track);
    });
    return groups;
  }, [filteredTracks]);

  const tracksByAlbum = useMemo(() => {
    const groups: Record<string, Track[]> = {};
    filteredTracks.forEach(track => {
      const album = track.album || "Unknown Album";
      if (!groups[album]) groups[album] = [];
      groups[album].push(track);
    });
    return groups;
  }, [filteredTracks]);

  const tracksByGenre = useMemo(() => {
    const groups: Record<string, Track[]> = {};
    filteredTracks.forEach(track => {
      const genre = track.genre || "Unknown Genre";
      if (!groups[genre]) groups[genre] = [];
      groups[genre].push(track);
    });
    return groups;
  }, [filteredTracks]);

  // Selection state helpers
  const toggleSelectTrack = (trackId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTrackIds(prev => 
      prev.includes(trackId) ? prev.filter(id => id !== trackId) : [...prev, trackId]
    );
  };

  const isAllSelected = filteredTracks.length > 0 && selectedTrackIds.length === filteredTracks.length;
  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedTrackIds([]);
    } else {
      setSelectedTrackIds(filteredTracks.map(t => t.id));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedTrackIds.length === 0) return;
    if (confirm(`Do you wish to remove the selected ${selectedTrackIds.length} track(s) from your music library?`)) {
      const idsToDelete = [...selectedTrackIds];
      setSelectedTrackIds([]);
      await deleteSelectedTracks(idsToDelete);
    }
  };

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full flex flex-col gap-8 text-left select-none text-slate-200 p-2 sm:p-4"
      id="elegant-my-music-view"
    >
      {/* 1. Elegant Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/5">
        <div>
          <h1 className="text-2xl font-sans font-light tracking-wide text-white flex items-center gap-2.5">
            <Music className="w-6 h-6 text-white stroke-[1.5] drop-shadow-[0_0_4px_rgba(255,255,255,0.4)]" />
            Your Music Collection
          </h1>
          <p className="text-xs text-slate-400 mt-1.5 font-light">
            Manage, upload, and sync your personalized library of audio tracks and dynamic calibration lists.
          </p>
        </div>
        
        {/* Songs Count Badge */}
        <div className="self-start md:self-center">
          <span className="px-4 py-2 rounded-2xl bg-white/[0.03] border border-white/10 text-xs text-slate-300 font-sans tracking-wider font-semibold">
            {uploadedTracks.length === 1 ? "1 Song Loaded" : `${uploadedTracks.length} Songs Loaded`}
          </span>
        </div>
      </div>

      {/* 2. Upload Zones: spacious, floating, relaxed feel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Upload Local File */}
        <label className="group relative flex items-center gap-5 p-6 rounded-2xl bg-[#0f0a09]/50 hover:bg-[#1a110f]/80 border border-slate-850 hover:border-slate-500 transition-all duration-300 cursor-pointer overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/[0.02] to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <input 
            type="file" 
            accept="audio/*" 
            multiple 
            onChange={(e) => {
              setUploadError("");
              setUploadSuccess("");
              handleFileUpload(e);
            }} 
            className="hidden" 
          />
          <div className="p-4 rounded-full bg-white/10 text-white group-hover:scale-110 transition-transform duration-300">
            <Upload className="w-5 h-5 stroke-[1.5]" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-sans font-semibold text-white tracking-wide">
              Add Local Tracks
            </span>
            <span className="text-xs text-slate-400 font-light">
              Choose audio files directly from your computer or device storage.
            </span>
          </div>
        </label>
        
        {/* Sync with Cloud Storage */}
        <label className="group relative flex items-center gap-5 p-6 rounded-2xl bg-[#0f0a09]/50 hover:bg-[#1a110f]/80 border border-slate-850 hover:border-slate-400 transition-all duration-300 cursor-pointer overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/[0.015] to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <input 
            type="file" 
            accept="audio/*" 
            onChange={(e) => {
              setUploadError("");
              setUploadSuccess("");
              handleCloudFileUpload(e);
            }} 
            className="hidden" 
          />
          <div className="p-4 rounded-full bg-white/10 text-white group-hover:scale-110 transition-transform duration-300">
            <Sparkles className="w-5 h-5 stroke-[1.5]" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-sans font-semibold text-white tracking-wide">
              Sync Cloud Storage
            </span>
            <span className="text-xs text-slate-400 font-light">
              {currentUser 
                ? "Back up and stream files securely across all synced devices." 
                : "Log in or register to synchronize your personal music cloud."}
            </span>
          </div>
        </label>
      </div>

      {/* Progress Bars and Status Alerts */}
      <AnimatePresence>
        {isUploading && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-5 rounded-2xl bg-slate-950/40 border border-white/15 flex flex-col gap-2.5"
          >
            <div className="flex justify-between items-center text-xs">
              <span className="text-white font-light flex items-center gap-2">
                <FolderSync className="w-4 h-4 text-white animate-spin" />
                Uploading your music file...
              </span>
              <span className="font-sans text-white font-semibold">{uploadProgress || 0}%</span>
            </div>
            <div className="h-1 bg-stone-900 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-slate-300 to-slate-100 transition-all duration-300" style={{ width: `${uploadProgress || 0}%` }} />
            </div>
          </motion.div>
        )}

        {uploadError && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-red-500/10 border border-red-500/10 text-xs text-red-400"
          >
            <p className="font-light">{uploadError}</p>
          </motion.div>
        )}

        {uploadSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/10 text-xs text-emerald-400"
          >
            <p className="font-light">{uploadSuccess}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Filtering & Beautiful Category Swapper */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mt-2">
        {/* Tab Buttons (Relaxed, no hard frames, floating accent hover) */}
        <div className="flex flex-wrap gap-2.5">
          {(["all", "artist", "album", "genre"] as const).map((catName) => {
            const label = catName === "all" ? "All Songs" : catName;
            const isActive = viewCategory === catName;
            return (
              <button
                key={catName}
                onClick={() => {
                  setViewCategory(catName);
                  setSelectedTrackIds([]);
                }}
                className={`px-5 py-2.5 rounded-xl font-sans text-xs uppercase tracking-wide transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-white/10 text-white font-semibold border border-slate-400"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.02]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Live Search Input with Glass Styling */}
        <div className="relative w-full lg:max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search songs, artists, or albums..."
            className="w-full bg-[#0f0a09]/50 hover:bg-white/[0.04] focus:bg-white/[0.05] border border-stone-850 focus:border-white/30 py-3 pl-11 pr-5 rounded-xl text-xs text-white placeholder-slate-400 outline-none transition-all duration-200"
          />
        </div>
      </div>

      {/* 4. Selection & Dynamic Action Panel */}
      {filteredTracks.length > 0 && (
        <div className="flex items-center justify-between bg-[#0f0a09]/50 border border-stone-850 p-4 rounded-2xl">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2.5 text-slate-400 hover:text-white text-xs tracking-wider transition-colors duration-150 cursor-pointer"
          >
            {isAllSelected ? (
              <CheckSquare className="w-4 h-4 text-white" />
            ) : (
              <Square className="w-4 h-4 text-slate-600" />
            )}
            <span>Select all songs ({filteredTracks.length})</span>
          </button>

          {selectedTrackIds.length > 0 && (
            <button
              onClick={handleBatchDelete}
              className="px-4 py-2 text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 active:scale-95 rounded-xl transition-all duration-150 flex items-center gap-2 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete selected ({selectedTrackIds.length})</span>
            </button>
          )}
        </div>
      )}

      {/* 5. Custom Tracks Listing Container */}
      <div className="flex flex-col gap-3 min-h-[220px]">
        {filteredTracks.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-white/[0.01] border border-dashed border-white/5">
            <FolderSync className="w-8 h-8 text-slate-500 mx-auto mb-3 stroke-[1.5] animate-pulse" />
            <h3 className="text-sm font-sans font-medium text-slate-300">
              {searchQuery ? "No search results match" : "Your music library is currently empty"}
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 font-light">
              {searchQuery 
                ? "Try checking your spelling or looking for a different title." 
                : "Add local files or log in to sync saved tracks on your profile."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {/* Direct Flat Stream view */}
            {viewCategory === "all" && (
              <div className="flex flex-col gap-1">
                 {filteredTracks.map((track) => {
                  const isSelectedForDel = selectedTrackIds.includes(track.id);
                  const isPlayingActive = track.id === currentPlayingTrackId;
                  return (
                    <div
                      key={track.id}
                      onClick={() => onPlayTrackById(track.id, filteredTracks)}
                      className={`p-4 rounded-xl border flex items-center justify-between gap-4 cursor-pointer group transition-all duration-200 ${
                        isPlayingActive
                          ? "bg-white/[0.04] border-white/30"
                          : "bg-[#0a0504]/50 hover:bg-[#150e0d]/50 border-stone-850/60 hover:border-slate-550/30"
                      }`}
                    >
                      <div className="flex items-center gap-3.5 max-w-[80%] truncate">
                        <button
                           onClick={(e) => toggleSelectTrack(track.id, e)}
                           className="text-slate-400 hover:text-white p-0.5 focus:outline-none cursor-pointer"
                        >
                          {isSelectedForDel ? (
                            <CheckSquare className="w-4 h-4 text-white" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-700 group-hover:text-slate-400 transition-colors" />
                          )}
                        </button>

                        <div className="truncate flex flex-col gap-0.5">
                          <span className={`text-[13px] font-sans font-semibold truncate ${isPlayingActive ? "text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.45)]" : "text-white group-hover:text-white transition-colors"}`}>
                            {track.name}
                          </span>
                          <span className="text-xs text-slate-400 font-light truncate">
                            {track.artist || "Unknown Artist"} • {track.album || "Unknown Album"} • {track.genre || "Unknown Genre"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {isPlayingActive && isPlaying ? (
                          <div className="flex items-end gap-0.5 h-3.5 mr-2">
                            <span className="w-0.5 bg-white rounded-full animate-bounce h-full" style={{ animationDuration: "1s" }} />
                            <span className="w-0.5 bg-white rounded-full animate-bounce h-2/3" style={{ animationDelay: "0.2s", animationDuration: "0.8s" }} />
                            <span className="w-0.5 bg-white rounded-full animate-bounce h-4/5" style={{ animationDelay: "0.4s", animationDuration: "1.1s" }} />
                          </div>
                        ) : null}
                        <span className="text-xs text-slate-400 font-sans font-medium">
                          {track.duration ? `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, "0")}` : ""}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ARTIST Grouping */}
            {viewCategory === "artist" && (
              <div className="flex flex-col gap-3">
                {Object.keys(tracksByArtist).sort().map((artistName) => {
                  const groupTracks = tracksByArtist[artistName];
                  const isExpanded = !!expandedGroups[artistName];
                  return (
                    <div key={artistName} className="rounded-xl border border-white/10 bg-[#0f0a09]/50 overflow-hidden">
                      <div
                        onClick={() => toggleGroup(artistName)}
                        className="p-4 bg-white/[0.015] flex items-center justify-between cursor-pointer hover:bg-white/[0.03] transition-colors"
                      >
                        <div className="flex items-center gap-3 text-slate-200">
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-white" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                          <Mic className="w-4 h-4 text-white" />
                          <span className="text-[13px] font-sans font-semibold tracking-wide text-white">{artistName}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-sans font-medium px-2 py-0.5 bg-white/[0.03] rounded-lg">
                          {groupTracks.length === 1 ? "1 song" : `${groupTracks.length} songs`}
                        </span>
                      </div>
                      
                      {isExpanded && (
                        <div className="p-2 bg-black/[0.15] border-t border-white/5 flex flex-col gap-1">
                          {groupTracks.map((track) => {
                            const isSelectedForDel = selectedTrackIds.includes(track.id);
                            const isPlayingActive = track.id === currentPlayingTrackId;
                            return (
                              <div
                                key={track.id}
                                onClick={() => onPlayTrackById(track.id, groupTracks)}
                                className={`p-3 rounded-lg flex items-center justify-between gap-3 cursor-pointer group transition-all ${
                                  isPlayingActive ? "bg-white/10" : "hover:bg-white/[0.02]"
                                }`}
                              >
                                <div className="flex items-center gap-3 truncate max-w-[80%]">
                                  <button
                                    onClick={(e) => toggleSelectTrack(track.id, e)}
                                    className="text-slate-450 hover:text-white p-0.5 focus:outline-none cursor-pointer"
                                  >
                                    {isSelectedForDel ? (
                                      <CheckSquare className="w-3.5 h-3.5 text-white" />
                                    ) : (
                                      <Square className="w-3.5 h-3.5 text-slate-700 group-hover:text-slate-400" />
                                    )}
                                  </button>
                                  <div className="truncate flex flex-col">
                                    <span className={`text-[12px] font-sans font-medium truncate ${isPlayingActive ? "text-white" : "text-slate-200"}`}>
                                      {track.name}
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-light mt-0.5">
                                      {track.album ? `${track.album}` : "Unknown Album"}
                                    </span>
                                  </div>
                                </div>
                                <span className="text-xs text-slate-500 font-sans font-medium">
                                  {track.duration ? `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, "0")}` : ""}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ALBUM Grouping */}
            {viewCategory === "album" && (
              <div className="flex flex-col gap-3">
                {Object.keys(tracksByAlbum).sort().map((albumName) => {
                  const groupTracks = tracksByAlbum[albumName];
                  const isExpanded = !!expandedGroups[albumName];
                  return (
                    <div key={albumName} className="rounded-xl border border-white/11 bg-[#0f0a09]/50 overflow-hidden">
                      <div
                        onClick={() => toggleGroup(albumName)}
                        className="p-4 bg-white/[0.015] flex items-center justify-between cursor-pointer hover:bg-white/[0.03] transition-colors"
                      >
                        <div className="flex items-center gap-3 text-slate-200">
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-white" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                          <Disc className="w-4 h-4 text-white" />
                          <span className="text-[13px] font-sans font-semibold tracking-wide text-white">{albumName}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-sans font-medium px-2 py-0.5 bg-white/[0.03] rounded-lg">
                          {groupTracks.length === 1 ? "1 song" : `${groupTracks.length} songs`}
                        </span>
                      </div>
                      
                      {isExpanded && (
                        <div className="p-2 bg-black/[0.15] border-t border-white/5 flex flex-col gap-1">
                          {groupTracks.map((track) => {
                            const isSelectedForDel = selectedTrackIds.includes(track.id);
                            const isPlayingActive = track.id === currentPlayingTrackId;
                            return (
                              <div
                                key={track.id}
                                onClick={() => onPlayTrackById(track.id, groupTracks)}
                                className={`p-3 rounded-lg flex items-center justify-between gap-3 cursor-pointer group transition-all duration-100 ${
                                  isPlayingActive ? "bg-white/10" : "hover:bg-white/[0.02]"
                                }`}
                              >
                                <div className="flex items-center gap-3 truncate max-w-[80%]">
                                  <button
                                    onClick={(e) => toggleSelectTrack(track.id, e)}
                                    className="text-slate-450 hover:text-white p-0.5 focus:outline-none cursor-pointer"
                                  >
                                    {isSelectedForDel ? (
                                      <CheckSquare className="w-3.5 h-3.5 text-white" />
                                    ) : (
                                      <Square className="w-3.5 h-3.5 text-slate-700 group-hover:text-slate-400" />
                                    )}
                                  </button>
                                  <div className="truncate flex flex-col">
                                    <span className={`text-[12px] font-sans font-medium truncate ${isPlayingActive ? "text-white" : "text-slate-200"}`}>
                                      {track.name}
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-light mt-0.5">
                                      {track.artist ? `${track.artist}` : "Unknown Artist"}
                                    </span>
                                  </div>
                                </div>
                                <span className="text-xs text-slate-500 font-sans font-medium">
                                  {track.duration ? `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, "0")}` : ""}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* GENRE Grouping */}
            {viewCategory === "genre" && (
              <div className="flex flex-col gap-3">
                {Object.keys(tracksByGenre).sort().map((genreName) => {
                  const groupTracks = tracksByGenre[genreName];
                  const isExpanded = !!expandedGroups[genreName];
                  return (
                    <div key={genreName} className="rounded-xl border border-white/10 bg-[#0f0a09]/50 overflow-hidden">
                      <div
                        onClick={() => toggleGroup(genreName)}
                        className="p-4 bg-white/[0.015] flex items-center justify-between cursor-pointer hover:bg-white/[0.03] transition-colors"
                      >
                        <div className="flex items-center gap-3 text-slate-200">
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-white" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                          <Tag className="w-4 h-4 text-white" />
                          <span className="text-[13px] font-sans font-semibold tracking-wide text-white">{genreName}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-sans font-medium px-2 py-0.5 bg-white/[0.03] rounded-lg">
                          {groupTracks.length === 1 ? "1 song" : `${groupTracks.length} songs`}
                        </span>
                      </div>
                      
                      {isExpanded && (
                        <div className="p-2 bg-black/[0.15] border-t border-white/5 flex flex-col gap-1">
                          {groupTracks.map((track) => {
                            const isSelectedForDel = selectedTrackIds.includes(track.id);
                            const isPlayingActive = track.id === currentPlayingTrackId;
                            return (
                              <div
                                key={track.id}
                                onClick={() => onPlayTrackById(track.id, groupTracks)}
                                className={`p-3 rounded-lg flex items-center justify-between gap-3 cursor-pointer group transition-all duration-100 ${
                                  isPlayingActive ? "bg-white/10" : "hover:bg-white/[0.02]"
                                }`}
                              >
                                <div className="flex items-center gap-3 truncate max-w-[80%]">
                                  <button
                                    onClick={(e) => toggleSelectTrack(track.id, e)}
                                    className="text-slate-450 hover:text-white p-0.5 focus:outline-none cursor-pointer"
                                  >
                                    {isSelectedForDel ? (
                                      <CheckSquare className="w-3.5 h-3.5 text-white" />
                                    ) : (
                                      <Square className="w-3.5 h-3.5 text-slate-700 group-hover:text-slate-400" />
                                    )}
                                  </button>
                                  <div className="truncate flex flex-col">
                                    <span className={`text-[12px] font-sans font-medium truncate ${isPlayingActive ? "text-white" : "text-slate-200"}`}>
                                      {track.name}
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-light mt-0.5">
                                      {track.artist ? `${track.artist}` : "Unknown Artist"} • {track.album ? `${track.album}` : "Unknown Album"}
                                    </span>
                                  </div>
                                </div>
                                <span className="text-xs text-slate-500 font-sans font-medium">
                                  {track.duration ? `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, "0")}` : ""}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default MyMusicView;
