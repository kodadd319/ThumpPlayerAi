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
  FolderSync
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
  onPlayTrackById: (trackId: string) => void;
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

  // 1. Filter out sample/built-in tracks to get only the user's uploaded library files
  const uploadedTracks = useMemo(() => {
    return playlist.filter(track => !track.id.startsWith("sample-"));
  }, [playlist]);

  // Determine current playing track if it's an uploaded track
  const currentPlayingTrackId = useMemo(() => {
    if (currentTrackIndex >= 0 && currentTrackIndex < playlist.length) {
      const active = playlist[currentTrackIndex];
      return active.id;
    }
    return null;
  }, [playlist, currentTrackIndex]);

  // Apply search query filter
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

  // 2. Compute categories mapping
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

  // Toggle single track selection
  const toggleSelectTrack = (trackId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTrackIds(prev => 
      prev.includes(trackId) ? prev.filter(id => id !== trackId) : [...prev, trackId]
    );
  };

  // Toggle selection for all filtered tracks
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
    if (confirm(`Are you sure you want to permanently delete ${selectedTrackIds.length} select track(s) from your music library?`)) {
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
    <div className="bg-gradient-to-b from-[#151924] to-[#0a0c12] border-2 border-slate-800/85 rounded-3xl p-5 shadow-2xl relative flex flex-col gap-5 select-none text-slate-100">
      
      {/* Header Info */}
      <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
        <div>
          <h3 className="font-mono text-[12px] font-black uppercase tracking-widest text-[#3adbff] flex items-center gap-1.5 leading-none">
            <Music className="w-4 h-4 text-sky-400 animate-pulse" />
            My Music Library
          </h3>
          <p className="text-[8.5px] font-mono text-slate-400 mt-1 uppercase tracking-wide">
            UPLOADED ARCHIVE PORTAL
          </p>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[9px] font-bold bg-[#0a0f1b] border border-sky-500/20 px-2.5 py-1 rounded text-[#3adbff]">
          <span>{uploadedTracks.length} CHROME TRACKS</span>
        </div>
      </div>

      {/* 2. Upload Sections */}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col items-center justify-center p-4 border border-dashed border-slate-700/80 rounded-xl hover:border-blue-500/50 hover:bg-blue-950/15 cursor-pointer group active:scale-98 transition-all text-center select-none backdrop-blur-xs">
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
          <Upload className="w-5 h-5 text-slate-400 group-hover:text-[#3adbff] mb-2 duration-150" />
          <span className="text-[10px] font-mono tracking-tight text-[#cbd5e1] font-bold">ADD OFF-LINE TRACK</span>
          <span className="text-[7.5px] font-mono text-slate-400 mt-0.5">LOCAL MP3 IN-DASH FILES</span>
        </label>
        
        <label className="flex flex-col items-center justify-center p-4 border border-dashed border-slate-700/80 rounded-xl hover:border-emerald-500/50 hover:bg-emerald-950/15 cursor-pointer group active:scale-98 transition-all text-center select-none backdrop-blur-xs">
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
          <Sparkles className="w-5 h-5 text-slate-400 group-hover:text-emerald-400 mb-2 duration-150" />
          <span className="text-[10px] font-mono tracking-tight text-[#cbd5e1] font-bold">SYNC CLOUD STORAGE</span>
          <span className="text-[7.5px] font-mono text-slate-400 mt-0.5">
            {currentUser ? "FIREBASE COMP STORAGE" : "LOG IN FOR SYNC"}
          </span>
        </label>
      </div>

      {/* Upload Progress Bar */}
      {isUploading && (
        <div className="p-3 bg-[#0a1523] border border-sky-500/20 rounded-xl flex flex-col gap-1.5 text-center">
          <div className="flex items-center justify-between text-[9px] font-mono font-bold text-[#3adbff]">
            <span>UPLOADING TO COMP STATION...</span>
            <span>{uploadProgress || 0}%</span>
          </div>
          <div className="h-1.5 bg-[#10192a] rounded-full overflow-hidden">
            <div className="h-full bg-[#3adbff] duration-150" style={{ width: `${uploadProgress || 0}%` }} />
          </div>
        </div>
      )}

      {/* Status Messages toasts */}
      {uploadError && (
        <p className="text-[8.5px] font-mono text-red-400 font-bold uppercase tracking-wide bg-red-950/20 border border-red-500/20 rounded-lg p-2.5">
          {uploadError}
        </p>
      )}
      {uploadSuccess && (
        <p className="text-[8.5px] font-mono text-emerald-400 font-bold uppercase tracking-wide bg-[#022d1a]/30 border border-emerald-500/20 rounded-lg p-2.5">
          {uploadSuccess}
        </p>
      )}

      {/* 3. Category selector & Search bar */}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-1 p-0.5 bg-slate-950/80 rounded-lg border border-slate-800/80">
          {(["all", "artist", "album", "genre"] as const).map((catName) => (
            <button
              key={catName}
              onClick={() => {
                setViewCategory(catName);
                setSelectedTrackIds([]);
              }}
              className={`py-1.5 rounded-md font-mono text-[8px] font-bold uppercase tracking-wider transition-colors duration-100 ${
                viewCategory === catName
                  ? "bg-[#0b1c3a] text-[#3adbff] border border-sky-500/30 font-black"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {catName === "all" ? "All Tracks" : catName}
            </button>
          ))}
        </div>

        {/* Live Filter query box */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="FILTER BY TITLE, ARTIST, ALBUM, OR GENRE..."
            className="w-full bg-[#030712]/90 border border-slate-800 focus:border-sky-500/50 rounded-lg py-2 pl-9 pr-4 text-[9px] font-mono uppercase tracking-wide text-white placeholder-slate-500 outline-none transition-colors"
          />
        </div>
      </div>

      {/* Deletion & Batch Selection Panel */}
      {filteredTracks.length > 0 && (
        <div className="flex items-center justify-between bg-slate-950/40 border border-slate-800 p-2.5 rounded-lg text-xs">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-1.5 text-slate-400 hover:text-[#3adbff] font-mono text-[9px] uppercase tracking-wider transition-colors duration-100 cursor-pointer"
          >
            {isAllSelected ? (
              <CheckSquare className="w-4 h-4 text-[#3adbff]" />
            ) : (
              <Square className="w-4 h-4 text-slate-500" />
            )}
            <span>Select All ({filteredTracks.length})</span>
          </button>

          {selectedTrackIds.length > 0 && (
            <button
              onClick={handleBatchDelete}
              className="px-2.5 py-1 text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/50 hover:bg-red-950/20 rounded font-mono text-[9px] uppercase tracking-wider flex items-center gap-1 transition-all duration-100 cursor-pointer active:scale-95"
            >
              <Trash2 className="w-3 h-3" />
              <span>DELETE SELECTED ({selectedTrackIds.length})</span>
            </button>
          )}
        </div>
      )}

      {/* 4. Categorized list content */}
      <div className="flex flex-col gap-2 max-h-[350px] overflow-y-auto pr-1">
        {filteredTracks.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl bg-slate-950/10">
            <FolderSync className="w-7 h-7 text-slate-600 mx-auto mb-2.5 animate-pulse" />
            <p className="text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider">
              {searchQuery ? "No matches found for filter string" : "Your music library is silent."}
            </p>
            <p className="text-[8px] font-mono text-slate-500 mt-1 uppercase">
              {searchQuery ? "Try a different search word" : "Upload standard in-dash MP3/WAV storage files to start"}
            </p>
          </div>
        ) : (
          <>
            {/* Flat List Component ("all") */}
            {viewCategory === "all" && (
              <div className="flex flex-col gap-1 text-xs">
                {filteredTracks.map((track) => {
                  const isSelectedForDel = selectedTrackIds.includes(track.id);
                  const isPlayingActive = track.id === currentPlayingTrackId;
                  return (
                    <div
                      key={track.id}
                      onClick={() => onPlayTrackById(track.id)}
                      className={`p-2.5 rounded-lg border flex items-center justify-between gap-3 cursor-pointer group transition-all relative ${
                        isPlayingActive
                          ? "bg-sky-500/10 border-sky-500/50 shadow-[#3adbff]/10 shadow-xs"
                          : "bg-[#0b0c10]/40 hover:bg-slate-900/60 border-slate-800/80 hover:border-slate-700/80"
                      }`}
                    >
                      <div className="flex items-center gap-2 max-w-[80%] truncate">
                        <button
                          onClick={(e) => toggleSelectTrack(track.id, e)}
                          className="text-slate-500 hover:text-sky-400 p-0.5 focus:outline-none"
                        >
                          {isSelectedForDel ? (
                            <CheckSquare className="w-3.5 h-3.5 text-sky-400" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400" />
                          )}
                        </button>

                        <div className="truncate flex flex-col">
                          <span className={`text-[10px] font-mono font-bold uppercase truncate ${isPlayingActive ? "text-sky-400" : "text-slate-200 group-hover:text-white"}`}>
                            {track.name}
                          </span>
                          <span className="text-[7.5px] font-mono text-slate-400 uppercase truncate mt-0.5">
                            {track.artist} // {track.album} // {track.genre}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isPlayingActive && isPlaying ? (
                          <span className="flex items-end gap-[1.5px] h-3 mr-1">
                            <span className="w-[1.5px] bg-[#3adbff] rounded-xs animate-bounce" style={{ height: "100%", animationDuration: "0.8s" }} />
                            <span className="w-[1.5px] bg-[#3adbff] rounded-xs animate-bounce" style={{ height: "60%", animationDelay: "0.15s", animationDuration: "0.6s" }} />
                            <span className="w-[1.5px] bg-[#3adbff] rounded-xs animate-bounce" style={{ height: "80%", animationDelay: "0.3s", animationDuration: "0.9s" }} />
                          </span>
                        ) : null}
                        <span className="text-[8.5px] font-mono text-[#3adbff]">
                          {track.duration ? `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, "0")}` : "0:00"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ARTIST Grouping */}
            {viewCategory === "artist" && (
              <div className="flex flex-col gap-2">
                {Object.keys(tracksByArtist).sort().map((artistName) => {
                  const groupTracks = tracksByArtist[artistName];
                  const isExpanded = !!expandedGroups[artistName];
                  return (
                    <div key={artistName} className="border border-slate-800/80 rounded-lg overflow-hidden bg-slate-900/10">
                      <div
                        onClick={() => toggleGroup(artistName)}
                        className="p-3 bg-[#0a0f1b]/70 flex items-center justify-between border-b border-slate-800/60 cursor-pointer hover:bg-slate-900/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-sky-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
                          <Mic className="w-3.5 h-3.5 text-sky-500" />
                          <span className="text-[10px] font-mono font-black uppercase text-slate-200">{artistName}</span>
                        </div>
                        <span className="text-[7.5px] font-mono text-slate-400 uppercase font-bold bg-[#0c1424] px-2 py-0.5 rounded border border-slate-800">
                          {groupTracks.length} tracks
                        </span>
                      </div>
                      
                      {isExpanded && (
                        <div className="p-1 px-1.5 flex flex-col gap-1.5 bg-[#03060f]/60">
                          {groupTracks.map((track) => {
                            const isSelectedForDel = selectedTrackIds.includes(track.id);
                            const isPlayingActive = track.id === currentPlayingTrackId;
                            return (
                              <div
                                key={track.id}
                                onClick={() => onPlayTrackById(track.id)}
                                className={`p-2 rounded flex items-center justify-between gap-3 cursor-pointer group transition-all ${
                                  isPlayingActive ? "bg-sky-500/5 border border-sky-500/20" : "hover:bg-slate-900/40"
                                }`}
                              >
                                <div className="flex items-center gap-2 max-w-[80%] truncate">
                                  <button
                                    onClick={(e) => toggleSelectTrack(track.id, e)}
                                    className="text-slate-500 hover:text-sky-400 p-0.5 focus:outline-none"
                                  >
                                    {isSelectedForDel ? (
                                      <CheckSquare className="w-3.5 h-3.5 text-sky-400" />
                                    ) : (
                                      <Square className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400" />
                                    )}
                                  </button>
                                  <div className="truncate flex flex-col">
                                    <span className={`text-[9.5px] font-mono font-bold uppercase truncate ${isPlayingActive ? "text-sky-400" : "text-slate-300"}`}>
                                      {track.name}
                                    </span>
                                    <span className="text-[7px] font-mono text-slate-500 uppercase truncate">
                                      ALBUM: {track.album} // GENRE: {track.genre}
                                    </span>
                                  </div>
                                </div>
                                <span className="text-[8.5px] font-mono text-slate-400">
                                  {track.duration ? `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, "0")}` : "0:00"}
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
              <div className="flex flex-col gap-2">
                {Object.keys(tracksByAlbum).sort().map((albumName) => {
                  const groupTracks = tracksByAlbum[albumName];
                  const isExpanded = !!expandedGroups[albumName];
                  return (
                    <div key={albumName} className="border border-slate-800/80 rounded-lg overflow-hidden bg-slate-900/10">
                      <div
                        onClick={() => toggleGroup(albumName)}
                        className="p-3 bg-[#0a0f1b]/70 flex items-center justify-between border-b border-slate-800/60 cursor-pointer hover:bg-slate-900/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-sky-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
                          <Disc className="w-3.5 h-3.5 text-sky-500" />
                          <span className="text-[10px] font-mono font-black uppercase text-slate-200">{albumName}</span>
                        </div>
                        <span className="text-[7.5px] font-mono text-slate-400 uppercase font-bold bg-[#0c1424] px-2 py-0.5 rounded border border-slate-800">
                          {groupTracks.length} tracks
                        </span>
                      </div>
                      
                      {isExpanded && (
                        <div className="p-1 px-1.5 flex flex-col gap-1.5 bg-[#03060f]/60">
                          {groupTracks.map((track) => {
                            const isSelectedForDel = selectedTrackIds.includes(track.id);
                            const isPlayingActive = track.id === currentPlayingTrackId;
                            return (
                              <div
                                key={track.id}
                                onClick={() => onPlayTrackById(track.id)}
                                className={`p-2 rounded flex items-center justify-between gap-3 cursor-pointer group transition-all ${
                                  isPlayingActive ? "bg-sky-500/5 border border-sky-500/20" : "hover:bg-slate-900/40"
                                }`}
                              >
                                <div className="flex items-center gap-2 max-w-[80%] truncate">
                                  <button
                                    onClick={(e) => toggleSelectTrack(track.id, e)}
                                    className="text-slate-500 hover:text-sky-400 p-0.5 focus:outline-none"
                                  >
                                    {isSelectedForDel ? (
                                      <CheckSquare className="w-3.5 h-3.5 text-sky-400" />
                                    ) : (
                                      <Square className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400" />
                                    )}
                                  </button>
                                  <div className="truncate flex flex-col">
                                    <span className={`text-[9.5px] font-mono font-bold uppercase truncate ${isPlayingActive ? "text-sky-400" : "text-slate-300"}`}>
                                      {track.name}
                                    </span>
                                    <span className="text-[7px] font-mono text-slate-500 uppercase truncate">
                                      ARTIST: {track.artist} // GENRE: {track.genre}
                                    </span>
                                  </div>
                                </div>
                                <span className="text-[8.5px] font-mono text-slate-400">
                                  {track.duration ? `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, "0")}` : "0:00"}
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
              <div className="flex flex-col gap-2">
                {Object.keys(tracksByGenre).sort().map((genreName) => {
                  const groupTracks = tracksByGenre[genreName];
                  const isExpanded = !!expandedGroups[genreName];
                  return (
                    <div key={genreName} className="border border-slate-800/80 rounded-lg overflow-hidden bg-slate-900/10">
                      <div
                        onClick={() => toggleGroup(genreName)}
                        className="p-3 bg-[#0a0f1b]/70 flex items-center justify-between border-b border-slate-800/60 cursor-pointer hover:bg-slate-900/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-sky-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
                          <Tag className="w-3.5 h-3.5 text-sky-500" />
                          <span className="text-[10px] font-mono font-black uppercase text-slate-200">{genreName}</span>
                        </div>
                        <span className="text-[7.5px] font-mono text-slate-400 uppercase font-bold bg-[#0c1424] px-2 py-0.5 rounded border border-slate-800">
                          {groupTracks.length} tracks
                        </span>
                      </div>
                      
                      {isExpanded && (
                        <div className="p-1 px-1.5 flex flex-col gap-1.5 bg-[#03060f]/60">
                          {groupTracks.map((track) => {
                            const isSelectedForDel = selectedTrackIds.includes(track.id);
                            const isPlayingActive = track.id === currentPlayingTrackId;
                            return (
                              <div
                                key={track.id}
                                onClick={() => onPlayTrackById(track.id)}
                                className={`p-2 rounded flex items-center justify-between gap-3 cursor-pointer group transition-all ${
                                  isPlayingActive ? "bg-sky-500/5 border border-sky-500/20" : "hover:bg-slate-900/40"
                                }`}
                              >
                                <div className="flex items-center gap-2 max-w-[80%] truncate">
                                  <button
                                    onClick={(e) => toggleSelectTrack(track.id, e)}
                                    className="text-slate-500 hover:text-sky-400 p-0.5 focus:outline-none"
                                  >
                                    {isSelectedForDel ? (
                                      <CheckSquare className="w-3.5 h-3.5 text-sky-400" />
                                    ) : (
                                      <Square className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400" />
                                    )}
                                  </button>
                                  <div className="truncate flex flex-col">
                                    <span className={`text-[9.5px] font-mono font-bold uppercase truncate ${isPlayingActive ? "text-sky-400" : "text-slate-300"}`}>
                                      {track.name}
                                    </span>
                                    <span className="text-[7px] font-mono text-slate-500 uppercase truncate">
                                      ARTIST: {track.artist} // ALBUM: {track.album}
                                    </span>
                                  </div>
                                </div>
                                <span className="text-[8.5px] font-mono text-slate-400">
                                  {track.duration ? `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, "0")}` : "0:00"}
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
          </>
        )}
      </div>
    </div>
  );
};
