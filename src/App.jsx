import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import "./App.css";

const STORAGE_KEY = "kid_player_progress_v1";
const TOKEN_KEY = "admin_token";
const VIDEOS_STORAGE_KEY = "videos_data";
const DELETED_IDS_KEY = "videos_deleted_ids";

// Auto-refresh interval (in milliseconds) - check for new videos
const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Gyerek mód: billentyűk tiltása
const DEFAULT_KID_MODE = true;

// Hardcoded admin credentials (will be replaced by real backend later)
const ADMIN_USER = "Gyerkoc";
const ADMIN_PASS = "Gyerkoc123";

// Auth helpers
function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

// ============================================
// MOCK BACKEND API - Replace with real API later
// ============================================

const MockAPI = {
  // Login - validates credentials locally
  async login(username, password) {
    // Simulate network delay
    await new Promise(r => setTimeout(r, 300));
    
    if (username === ADMIN_USER && password === ADMIN_PASS) {
      const token = "mock_token_" + Date.now();
      return { success: true, token };
    }
    throw new Error("Invalid credentials");
  },

  // Check if token is valid
  async checkAuth(token) {
    await new Promise(r => setTimeout(r, 100));
    return token && token.startsWith("mock_token_");
  },

  // Logout
  async logout() {
    await new Promise(r => setTimeout(r, 100));
    return { success: true };
  },

  // Load deleted IDs from localStorage
  _getDeletedIds() {
    try {
      return JSON.parse(localStorage.getItem(DELETED_IDS_KEY) || "[]");
    } catch {
      return [];
    }
  },

  // Save deleted IDs to localStorage
  _saveDeletedIds(ids) {
    localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(ids));
  },

  // Load videos with smart merge:
  // 1. Fetch original videos.json
  // 2. Merge with localStorage edits
  // 3. Exclude deleted IDs
  // 4. Add new videos from json that aren't in localStorage
  async getVideos() {
    await new Promise(r => setTimeout(r, 100));
    
    // 1. Load original videos.json
    let originalVideos = [];
    try {
      const res = await fetch("/videos.json", { cache: "no-store" });
      originalVideos = await res.json();
    } catch {
      originalVideos = [];
    }
    
    // 2. Load localStorage data
    let localVideos = [];
    const stored = localStorage.getItem(VIDEOS_STORAGE_KEY);
    if (stored) {
      try {
        localVideos = JSON.parse(stored);
      } catch {}
    }
    
    // 3. Load deleted IDs
    const deletedIds = this._getDeletedIds();
    
    // 4. If no local data, return original (minus deleted)
    if (localVideos.length === 0) {
      return originalVideos.filter(v => !deletedIds.includes(v.id));
    }
    
    // 5. Smart merge
    const localMap = new Map(localVideos.map(v => [v.id, v]));
    const mergedVideos = [...localVideos];
    
    // Add new videos from original that don't exist in local and aren't deleted
    for (const origVideo of originalVideos) {
      if (!localMap.has(origVideo.id) && !deletedIds.includes(origVideo.id)) {
        mergedVideos.push(origVideo);
      }
    }
    
    return mergedVideos;
  },

  // Save videos - saves to localStorage
  async saveVideos(videos) {
    await new Promise(r => setTimeout(r, 200));
    localStorage.setItem(VIDEOS_STORAGE_KEY, JSON.stringify(videos));
    return { success: true };
  },

  // Delete video - also track the ID so it won't be re-merged
  async deleteVideo(videoId) {
    const deletedIds = this._getDeletedIds();
    if (!deletedIds.includes(videoId)) {
      deletedIds.push(videoId);
      this._saveDeletedIds(deletedIds);
    }
  },

  // Reset to original (clear localStorage)
  async resetVideos() {
    localStorage.removeItem(VIDEOS_STORAGE_KEY);
    localStorage.removeItem(DELETED_IDS_KEY);
    const res = await fetch("/videos.json", { cache: "no-store" });
    return res.json();
  }
};

// Export for future backend replacement
// Just replace MockAPI with RealAPI that calls actual endpoints
// ============================================

// Login Modal Component
function LoginModal({ onLogin, onClose }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await MockAPI.login(username, password);
      setToken(data.token);
      onLogin(data.token);
    } catch (err) {
      setError("Hibás felhasználónév vagy jelszó");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Admin bejelentkezés</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Felhasználónév"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
          <input
            type="password"
            placeholder="Jelszó"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <div className="error">{error}</div>}
          <div className="modal-buttons">
            <button type="button" onClick={onClose} className="btn-secondary">
              Mégse
            </button>
            <button type="submit" disabled={loading}>
              {loading ? "..." : "Belépés"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Video Editor Modal Component
function VideoEditorModal({ video, onSave, onDelete, onClose, isNew }) {
  const [formData, setFormData] = useState(
    video || {
      id: "",
      title: "",
      type: "youtube",
      url: "",
      subtitles: "",
      createdAt: new Date().toISOString(),
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    // Generate ID if new and empty
    const data = {
      ...formData,
      id: formData.id || `video-${Date.now()}`,
    };
    // Remove empty subtitles
    if (!data.subtitles) delete data.subtitles;
    onSave(data);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isNew ? "Új videó hozzáadása" : "Videó szerkesztése"}</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Cím"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
          />
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
          >
            <option value="youtube">YouTube</option>
            <option value="mp4">MP4</option>
            <option value="hls">HLS Stream</option>
          </select>
          <input
            type="text"
            placeholder={
              formData.type === "youtube" 
                ? "YouTube URL" 
                : formData.type === "hls"
                ? "HLS URL (pl: https://example.com/stream.m3u8)"
                : "MP4 URL (pl: /videos/film.mp4 vagy https://example.com/video.mp4)"
            }
            value={formData.url}
            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            required
          />
          {/* Subtitles field - only for MP4 and HLS */}
          {formData.type !== "youtube" && (
            <input
              type="text"
              placeholder="Felirat URL (opcionális, pl: /videos/film.vtt)"
              value={formData.subtitles || ""}
              onChange={(e) => setFormData({ ...formData, subtitles: e.target.value })}
            />
          )}
          <div className="modal-buttons">
            {!isNew && (
              <button
                type="button"
                onClick={() => onDelete(formData)}
                className="btn-danger"
              >
                Törlés
              </button>
            )}
            <button type="button" onClick={onClose} className="btn-secondary">
              Mégse
            </button>
            <button type="submit">Mentés</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function loadProgressMap() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveProgressMap(map) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

function parseYouTubeVideoId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.replace("/", "");
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    return null;
  } catch {
    return null;
  }
}

function sortByCreatedAtDesc(list) {
  return [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function pickNextVideo(videos, progressMap) {
  const sorted = sortByCreatedAtDesc(videos);
  const unseen = sorted.find((v) => !progressMap[v.id]?.seen);
  return unseen || sorted[0] || null;
}

function useDisableKeyboard(enabled) {
  useEffect(() => {
    if (!enabled) return;

    const block = (e) => {
      // Allow typing in input fields, textareas, and selects
      const tagName = e.target.tagName.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
        return true;
      }
      
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    window.addEventListener("keydown", block, { capture: true });
    window.addEventListener("keyup", block, { capture: true });
    window.addEventListener("keypress", block, { capture: true });

    return () => {
      window.removeEventListener("keydown", block, { capture: true });
      window.removeEventListener("keyup", block, { capture: true });
      window.removeEventListener("keypress", block, { capture: true });
    };
  }, [enabled]);
}

function Mp4Player({ src, startAt, onReady, onError, onEnded, subtitles }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const wrapper = {
      play: () => el.play().catch(() => onError?.("Playback failed")),
      pause: () => el.pause(),
      seekTo: (s) => {
        el.currentTime = Math.max(0, s);
      },
      getCurrentTime: async () => el.currentTime || 0,
      getDuration: async () => el.duration || 0,
      isPaused: async () => el.paused,
      setOnEnded: (cb) => {
        el.addEventListener('ended', cb);
      },
      setOnTime: (cb) => {
        el.ontimeupdate = () => cb(el.currentTime || 0, el.duration || 0);
      },
      requestFullscreen: () => {
        if (el.requestFullscreen) el.requestFullscreen();
      }
    };

    const applyStart = () => {
      if (Number.isFinite(startAt) && startAt > 0) {
        el.currentTime = startAt;
      }
    };

    // Handle video end
    const handleEnded = () => {
      onEnded?.();
    };
    el.addEventListener('ended', handleEnded);

    el.onloadedmetadata = () => {
      applyStart();
      onReady(wrapper);
    };

    el.onerror = () => {
      console.error("MP4 video error:", src);
      onError?.("Video failed to load");
    };

    if (el.readyState >= 1) {
      applyStart();
      onReady(wrapper);
    }

    return () => {
      el.removeEventListener('ended', handleEnded);
    };
  }, [startAt, onReady, onError, onEnded, src]);

  return (
    <video
      ref={videoRef}
      className="media"
      src={src}
      controls={true}
      playsInline
      autoPlay={false}
    >
      {subtitles && (
        <track
          kind="subtitles"
          src={subtitles}
          srcLang="hu"
          label="Magyar"
          default
        />
      )}
    </video>
  );
}

// HLS Streaming Player (for .m3u8 streams)
function HlsPlayer({ src, startAt, onReady, onError, onEnded, subtitles }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    retryCountRef.current = 0;

    const wrapper = {
      play: () => el.play().catch(() => onError?.("Playback failed")),
      pause: () => el.pause(),
      seekTo: (s) => {
        el.currentTime = Math.max(0, s);
      },
      getCurrentTime: async () => el.currentTime || 0,
      getDuration: async () => el.duration || 0,
      isPaused: async () => el.paused,
      setOnEnded: () => {},
      setOnTime: (cb) => {
        el.ontimeupdate = () => cb(el.currentTime || 0, el.duration || 0);
      },
      requestFullscreen: () => {
        if (el.requestFullscreen) el.requestFullscreen();
      }
    };

    const applyStart = () => {
      if (Number.isFinite(startAt) && startAt > 0) {
        el.currentTime = startAt;
      }
    };

    // Handle video end
    const handleEnded = () => {
      onEnded?.();
    };
    el.addEventListener('ended', handleEnded);

    // Handle stall/waiting - stream might have stopped
    let stallTimeout = null;
    const handleWaiting = () => {
      // If waiting for more than 10 seconds, assume stream stopped
      stallTimeout = setTimeout(() => {
        console.log("Stream stalled for too long, moving to next video");
        onEnded?.();
      }, 10000);
    };
    const handlePlaying = () => {
      if (stallTimeout) {
        clearTimeout(stallTimeout);
        stallTimeout = null;
      }
    };
    el.addEventListener('waiting', handleWaiting);
    el.addEventListener('playing', handlePlaying);

    const initPlayer = () => {
      el.onloadedmetadata = () => {
        applyStart();
        onReady(wrapper);
      };

      if (el.readyState >= 1) {
        applyStart();
        onReady(wrapper);
      }
    };

    // Check if HLS is supported natively (Safari)
    if (el.canPlayType('application/vnd.apple.mpegurl')) {
      el.src = src;
      el.onerror = () => {
        console.log("Native HLS error, moving to next video");
        onEnded?.();
      };
      initPlayer();
    } 
    // Use hls.js for other browsers
    else if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
      });
      
      hlsRef.current = hls;
      
      hls.loadSource(src);
      hls.attachMedia(el);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        retryCountRef.current = 0; // Reset retries on success
        initPlayer();
      });

      // Handle manifest load error (stream not available)
      hls.on(Hls.Events.MANIFEST_LOADING_ERROR, () => {
        console.log("Stream not available, moving to next video");
        onEnded?.();
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.log("HLS error:", data.type, data.details, "fatal:", data.fatal);
        
        if (data.fatal) {
          retryCountRef.current++;
          
          if (retryCountRef.current > MAX_RETRIES) {
            console.log("Max retries reached, moving to next video");
            onEnded?.();
            return;
          }

          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log("Network error, retrying...", retryCountRef.current);
              setTimeout(() => hls.startLoad(), 1000);
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log("Media error, recovering...", retryCountRef.current);
              hls.recoverMediaError();
              break;
            default:
              console.log("Unrecoverable error, moving to next video");
              onEnded?.();
              break;
          }
        }
      });
    } else {
      onError?.("HLS streaming not supported in this browser");
    }

    return () => {
      if (stallTimeout) clearTimeout(stallTimeout);
      el.removeEventListener('ended', handleEnded);
      el.removeEventListener('waiting', handleWaiting);
      el.removeEventListener('playing', handlePlaying);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src, startAt, onReady, onError, onEnded]);

  return (
    <video
      ref={videoRef}
      className="media"
      controls={true}
      playsInline
      autoPlay={false}
    >
      {subtitles && (
        <track
          kind="subtitles"
          src={subtitles}
          srcLang="hu"
          label="Magyar"
          default
        />
      )}
    </video>
  );
}

function YouTubePlayer({ videoId, startAt, onReady, onError, onEnded }) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const callbacksRef = useRef({ onReady, onError, onEnded });

  // Update callbacks ref without triggering re-render
  useEffect(() => {
    callbacksRef.current = { onReady, onError, onEnded };
  }, [onReady, onError, onEnded]);

  useEffect(() => {
    let mounted = true;

    // Load YouTube IFrame API if not already loaded
    const loadAPI = () => {
      return new Promise((resolve) => {
        if (window.YT && window.YT.Player) {
          resolve();
          return;
        }

        if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
          const tag = document.createElement('script');
          tag.src = 'https://www.youtube.com/iframe_api';
          document.head.appendChild(tag);
        }

        const checkReady = setInterval(() => {
          if (window.YT && window.YT.Player) {
            clearInterval(checkReady);
            resolve();
          }
        }, 100);
      });
    };

    const initPlayer = async () => {
      await loadAPI();
      
      if (!mounted || !containerRef.current) return;
      
      // Destroy previous player if exists
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {}
        playerRef.current = null;
      }

      // Create a unique div for the player
      const playerDiv = document.createElement('div');
      playerDiv.id = 'yt-player-' + Date.now();
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(playerDiv);

      playerRef.current = new window.YT.Player(playerDiv.id, {
        videoId: videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          controls: 1,
          cc_load_policy: 1,  // Enable captions by default
          cc_lang_pref: 'hu', // Prefer Hungarian captions
          hl: 'hu',           // Interface language (helps with auto-captions)
          start: startAt > 0 ? Math.floor(startAt) : undefined
        },
        events: {
          onReady: (event) => {
            if (!mounted) return;
            const ytPlayer = event.target;
            
            // Try to enable captions via API
            try {
              // Load captions module and set language
              ytPlayer.loadModule('captions');
              ytPlayer.setOption('captions', 'track', { languageCode: 'hu' });
            } catch (e) {
              // Captions might not be available
              console.log('Captions not available for this video');
            }
            const wrapper = {
              play: () => ytPlayer.playVideo(),
              pause: () => ytPlayer.pauseVideo(),
              seekTo: (s) => ytPlayer.seekTo(s, true),
              getCurrentTime: async () => ytPlayer.getCurrentTime() || 0,
              getDuration: async () => ytPlayer.getDuration() || 0,
              isPaused: async () => ytPlayer.getPlayerState() !== 1,
              setOnEnded: () => {},
              setOnTime: () => {},
              requestFullscreen: () => {
                try {
                  const iframe = ytPlayer.getIframe();
                  iframe?.requestFullscreen?.();
                } catch {}
              }
            };
            callbacksRef.current.onReady?.(wrapper);
          },
          onStateChange: (event) => {
            if (!mounted) return;
            // YT.PlayerState.ENDED = 0
            if (event.data === 0) {
              callbacksRef.current.onEnded?.();
            }
          },
          onError: () => {
            if (!mounted) return;
            callbacksRef.current.onError?.("YouTube video failed to load");
          }
        }
      });
    };

    initPlayer();

    return () => {
      mounted = false;
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {}
        playerRef.current = null;
      }
    };
  }, [videoId, startAt]); // Only re-init when video or startAt changes

  return <div ref={containerRef} className="yt-container" />;
}

export default function App() {
  const [videos, setVideos] = useState([]);
  const [progressMap, setProgressMap] = useState(() => loadProgressMap());

  const [current, setCurrent] = useState(null);
  const [player, setPlayer] = useState(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const [kidMode] = useState(DEFAULT_KID_MODE);

  const [playlistOpen, setPlaylistOpen] = useState(false);

  // Admin state
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [editingVideo, setEditingVideo] = useState(null);
  const [isNewVideo, setIsNewVideo] = useState(false);
  const [saving, setSaving] = useState(false);

  useDisableKeyboard(kidMode && !isAdmin);

  // Check if already logged in
  useEffect(() => {
    const token = getToken();
    if (token) {
      MockAPI.checkAuth(token)
        .then((valid) => valid && setIsAdmin(true))
        .catch(() => setToken(null));
    }
  }, []);

  // Load videos
  const loadVideos = useCallback(async () => {
    try {
      const list = await MockAPI.getVideos();
      setVideos(list || []);
    } catch {
      setVideos([]);
    }
  }, []);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  // Auto-refresh timer - periodically check for new videos
  useEffect(() => {
    const interval = setInterval(() => {
      console.log("Auto-refreshing video list...");
      loadVideos();
    }, AUTO_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [loadVideos]);

  // Save videos
  const saveVideos = async (newVideos) => {
    const token = getToken();
    if (!token) return false;

    setSaving(true);
    try {
      await MockAPI.saveVideos(newVideos);
      setVideos(newVideos);
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Login handler
  const handleLogin = (token) => {
    setIsAdmin(true);
    setShowLogin(false);
  };

  // Logout handler
  const handleLogout = async () => {
    await MockAPI.logout().catch(() => {});
    setToken(null);
    setIsAdmin(false);
  };

  // Video CRUD handlers
  const handleSaveVideo = async (videoData) => {
    let newVideos;
    if (isNewVideo) {
      newVideos = [...videos, videoData];
    } else {
      newVideos = videos.map((v) =>
        v.id === editingVideo.id && v.url === editingVideo.url ? videoData : v
      );
    }

    const success = await saveVideos(newVideos);
    if (success) {
      setEditingVideo(null);
      setIsNewVideo(false);
    } else {
      alert("Mentés sikertelen!");
    }
  };

  const handleDeleteVideo = async (videoData) => {
    if (!confirm(`Biztosan törlöd: "${videoData.title}"?`)) return;

    const newVideos = videos.filter(
      (v) => !(v.id === videoData.id && v.url === videoData.url)
    );

    // Track deleted ID so it won't be re-merged from videos.json
    await MockAPI.deleteVideo(videoData.id);

    const success = await saveVideos(newVideos);
    if (success) {
      setEditingVideo(null);
      if (current?.id === videoData.id && current?.url === videoData.url) {
        setCurrent(newVideos[0] || null);
      }
    } else {
      alert("Törlés sikertelen!");
    }
  };

  const openAddVideo = () => {
    setEditingVideo(null);
    setIsNewVideo(true);
  };

  const openEditVideo = (video) => {
    setEditingVideo(video);
    setIsNewVideo(false);
  };

  useEffect(() => {
    if (!videos.length) return;
    const savedProgress = loadProgressMap();
    const next = pickNextVideo(videos, savedProgress);
    setCurrent(next);
  }, [videos]);

  const startAt = useMemo(() => {
    if (!current) return 0;
    const saved = loadProgressMap();
    return saved[current.id]?.progress || 0;
  }, [current]);

  const currentIdRef = useRef(null);
  useEffect(() => {
    currentIdRef.current = current?.id;
  }, [current?.id]);

  useEffect(() => {
    if (!player || !current) return;
    
    const videoId = current.id;
    let lastSavedTime = 0;

    player.setOnTime?.((ct, dur) => {
      setCurrentTime(ct);
      setDuration(dur || 0);

      if (Math.abs(ct - lastSavedTime) >= 5) {
        lastSavedTime = ct;
        const progressData = loadProgressMap();
        progressData[videoId] = {
          seen: progressData[videoId]?.seen || false,
          progress: ct || 0,
          updatedAt: Date.now()
        };
        saveProgressMap(progressData);
      }
    });

    player.setOnEnded?.(() => {
      const progressData = loadProgressMap();
      progressData[videoId] = {
        seen: true,
        progress: 0,
        updatedAt: Date.now()
      };
      saveProgressMap(progressData);
      setProgressMap(progressData);

      const nextVideo = pickNextVideo(videos, progressData);
      setCurrent(nextVideo);
      setPlayer(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    });
  }, [player, current?.id, videos]);

  const togglePlay = async () => {
    if (!player) return;

    const paused = await player.isPaused();
    if (paused) {
      player.play();
      setIsPlaying(true);
    } else {
      player.pause();
      setIsPlaying(false);
    }
  };

  const seekBy = async (delta) => {
    if (!player) return;
    const ct = await player.getCurrentTime();
    player.seekTo(ct + delta);
  };

  const onSliderChange = (e) => {
    e.stopPropagation();
    const val = Number(e.target.value);
    if (!player || !duration) return;
    const t = (val / 100) * duration;
    player.seekTo(t);
  };

  const onSliderClick = (e) => {
    e.stopPropagation();
  };

  const requestFullscreen = () => {
    if (!player) return;
    player.requestFullscreen?.();
  };

  const startPlayback = async () => {
    if (player) {
      try {
        await player.play();
      } catch (e) {
        // YouTube doesn't need this
      }
    }
    setIsPlaying(true);
  };

  const selectVideo = (video) => {
    if (video.id === current?.id && video.url === current?.url) return;
    setCurrent(video);
    setPlayer(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  };

  const togglePlaylist = (e) => {
    e.stopPropagation();
    setPlaylistOpen(prev => !prev);
  };

  const sortedVideos = useMemo(() => sortByCreatedAtDesc(videos), [videos]);

  const currentIndex = useMemo(() => {
    if (!current) return -1;
    return sortedVideos.findIndex(v => v.id === current.id && v.url === current.url);
  }, [sortedVideos, current]);

  const jumpToNext = useCallback(() => {
    if (sortedVideos.length === 0) return;
    
    // Prioritize unseen videos (newest first)
    // 1. Look for unseen video after current position
    let nextVideo = null;
    for (let i = currentIndex + 1; i < sortedVideos.length; i++) {
      if (!progressMap[sortedVideos[i].id]?.seen) {
        nextVideo = sortedVideos[i];
        break;
      }
    }
    
    // 2. If not found, look from the beginning (before current position)
    if (!nextVideo) {
      for (let i = 0; i < currentIndex; i++) {
        if (!progressMap[sortedVideos[i].id]?.seen) {
          nextVideo = sortedVideos[i];
          break;
        }
      }
    }
    
    // 3. If all are seen, just go to next in order
    if (!nextVideo) {
      const nextIndex = currentIndex < sortedVideos.length - 1 ? currentIndex + 1 : 0;
      nextVideo = sortedVideos[nextIndex];
    }
    
    if (nextVideo) {
      setCurrent(nextVideo);
      setPlayer(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    }
  }, [sortedVideos, currentIndex, progressMap]);

  const jumpToPrevious = useCallback(() => {
    if (sortedVideos.length === 0) return;
    
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : sortedVideos.length - 1;
    const prevVideo = sortedVideos[prevIndex];
    
    if (prevVideo) {
      setCurrent(prevVideo);
      setPlayer(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    }
  }, [sortedVideos, currentIndex]);

  const getVideoThumbnail = (video) => {
    if (video.type === "youtube") {
      const vid = parseYouTubeVideoId(video.url);
      if (vid) return `https://img.youtube.com/vi/${vid}/mqdefault.jpg`;
    }
    return null;
  };

  const skipToNext = useCallback((errorMsg) => {
    console.warn("Skipping video due to error:", errorMsg, "Current:", current?.id);
    
    if (current) {
      setProgressMap((prev) => {
        const next = {
          ...prev,
          [current.id]: {
            seen: true,
            progress: 0,
            error: true,
            updatedAt: Date.now()
          }
        };
        saveProgressMap(next);
        return next;
      });
    }

    const savedProgress = loadProgressMap();
    const nextVideo = pickNextVideo(
      videos.filter(v => v.id !== current?.id), 
      savedProgress
    );
    
    if (nextVideo) {
      setCurrent(nextVideo);
      setPlayer(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    }
  }, [current, videos]);

  const renderPlayer = () => {
    if (!current) return <div className="empty">Nincs videó a listában.</div>;

    if (current.type === "youtube") {
      const vid = parseYouTubeVideoId(current.url);
      if (!vid) {
        setTimeout(() => skipToNext("Invalid YouTube URL"), 1000);
        return <div className="empty">Hibás YouTube URL, következő...</div>;
      }
      
      if (!isPlaying) {
        return (
          <div className="yt-thumbnail">
            <img 
              src={`https://img.youtube.com/vi/${vid}/maxresdefault.jpg`} 
              alt={current.title || "YouTube video"}
              onError={(e) => {
                e.target.src = `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
              }}
            />
          </div>
        );
      }
      
      return (
        <YouTubePlayer
          videoId={vid}
          startAt={startAt}
          onReady={(p) => setPlayer(p)}
          onError={skipToNext}
          onEnded={() => {
            // Mark as seen and jump to next
            const progressData = loadProgressMap();
            progressData[current.id] = {
              seen: true,
              progress: 0,
              updatedAt: Date.now()
            };
            saveProgressMap(progressData);
            setProgressMap(progressData);
            jumpToNext();
          }}
        />
      );
    }

    if (current.type === "mp4") {
      return (
        <Mp4Player
          src={current.url}
          startAt={startAt}
          subtitles={current.subtitles}
          onReady={(p) => setPlayer(p)}
          onError={skipToNext}
          onEnded={() => {
            // Mark as seen and jump to next
            const progressData = loadProgressMap();
            progressData[current.id] = {
              seen: true,
              progress: 0,
              updatedAt: Date.now()
            };
            saveProgressMap(progressData);
            setProgressMap(progressData);
            jumpToNext();
          }}
        />
      );
    }

    if (current.type === "hls") {
      return (
        <HlsPlayer
          src={current.url}
          startAt={startAt}
          subtitles={current.subtitles}
          onReady={(p) => setPlayer(p)}
          onError={skipToNext}
          onEnded={() => {
            // Mark as seen and jump to next
            const progressData = loadProgressMap();
            progressData[current.id] = {
              seen: true,
              progress: 0,
              updatedAt: Date.now()
            };
            saveProgressMap(progressData);
            setProgressMap(progressData);
            jumpToNext();
          }}
        />
      );
    }

    setTimeout(() => skipToNext(`Unknown type: ${current.type}`), 1000);
    return <div className="empty">Ismeretlen type: {current.type}, következő...</div>;
  };

  const progressPct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const isYouTube = current?.type === "youtube";

  return (
    <div className="app">
      {/* Login Modal */}
      {showLogin && (
        <LoginModal onLogin={handleLogin} onClose={() => setShowLogin(false)} />
      )}

      {/* Video Editor Modal */}
      {(editingVideo || isNewVideo) && (
        <VideoEditorModal
          video={editingVideo}
          isNew={isNewVideo}
          onSave={handleSaveVideo}
          onDelete={handleDeleteVideo}
          onClose={() => {
            setEditingVideo(null);
            setIsNewVideo(false);
          }}
        />
      )}

      <div className={`main-content ${playlistOpen ? 'playlist-open' : ''}`}>
        <div className="stage">
          {renderPlayer()}

          {!isPlaying && (
            <button className="bigPlay" onClick={startPlayback}>
              ▶
            </button>
          )}

          {/* Controls for MP4 - pointer-events: none on container, auto on interactive elements */}
          {!isYouTube && (
            <div className="controls visible">
              <div className="row">
                <button onClick={jumpToPrevious} title="Előző">⏮</button>
                <button onClick={togglePlay}>⏯</button>
                <button onClick={() => seekBy(-10)}>⏪ 10</button>
                <button onClick={() => seekBy(10)}>10 ⏩</button>
                <button onClick={jumpToNext} title="Következő">⏭</button>
                <button onClick={requestFullscreen}>⛶</button>
              </div>

              <input
                type="range"
                min="0"
                max="100"
                value={progressPct}
                onChange={onSliderChange}
                onClick={onSliderClick}
                onMouseDown={onSliderClick}
                onTouchStart={onSliderClick}
              />

              <div className="meta">
                <div className="title">{current?.title || current?.id}</div>
                <div className="time-info">
                  <span className="time">
                    {Math.floor(currentTime)}s / {Math.floor(duration)}s
                  </span>
                  <span className="video-counter">
                    {currentIndex + 1} / {sortedVideos.length}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Controls for YouTube */}
          {isYouTube && (
            <div className="controls youtube-controls visible">
              <div className="row">
                <button onClick={jumpToPrevious} title="Előző">⏮</button>
                <button onClick={jumpToNext} title="Következő">⏭</button>
                <button onClick={requestFullscreen}>⛶</button>
              </div>
              <div className="meta">
                <div className="title">{current?.title || current?.id}</div>
                <div className="video-counter">
                  {currentIndex + 1} / {sortedVideos.length}
                </div>
              </div>
            </div>
          )}

          {/* Admin login button */}
          <button
            className="admin-toggle visible"
            onClick={() => (isAdmin ? handleLogout() : setShowLogin(true))}
            title={isAdmin ? "Kijelentkezés" : "Admin belépés"}
          >
            {isAdmin ? "🔓" : "🔐"}
          </button>

          <button 
            className="playlist-toggle visible"
            onClick={togglePlaylist}
            title={playlistOpen ? "Lista elrejtése" : "Lista megjelenítése"}
          >
            {playlistOpen ? '»' : '☰'}
          </button>
        </div>

        <div className="footerHint">
          {isAdmin ? (
            <span className="admin-badge">Admin mód aktív</span>
          ) : (
            "(Tipp: a lista frissítéséhez elég a videos.json-t módosítani és újratölteni az oldalt.)"
          )}
        </div>

        <div className="tinyNote">
          Nyomd meg a play gombot - utána a videó hanggal játszik.
        </div>
      </div>

      <div className={`playlist-sidebar ${playlistOpen ? 'open' : ''}`}>
        <div className="playlist-header">
          <h3>Lejátszási lista</h3>
          <div className="playlist-header-buttons">
            {isAdmin && (
              <button
                className="btn-add"
                onClick={openAddVideo}
                title="Új videó hozzáadása"
              >
                +
              </button>
            )}
            <button className="playlist-close" onClick={togglePlaylist}>✕</button>
          </div>
        </div>
        <div className="playlist-items">
          {sortedVideos.map((video, idx) => {
            const isActive = video.id === current?.id && video.url === current?.url;
            const isSeen = progressMap[video.id]?.seen;
            const thumbnail = getVideoThumbnail(video);
            
            return (
              <div
                key={video.id + video.url + idx}
                className={`playlist-item ${isActive ? 'active' : ''} ${isSeen ? 'seen' : ''}`}
                onClick={() => selectVideo(video)}
              >
                <div className="playlist-item-thumbnail">
                  {thumbnail ? (
                    <img src={thumbnail} alt={video.title} />
                  ) : (
                    <div className="playlist-item-placeholder">
                      {video.type === 'mp4' ? '🎬' : '🎵'}
                    </div>
                  )}
                  {isActive && <div className="playing-indicator">▶</div>}
                </div>
                <div className="playlist-item-info">
                  <div className="playlist-item-title">{video.title || video.id}</div>
                  <div className="playlist-item-meta">
                    <span className="playlist-item-type">{video.type.toUpperCase()}</span>
                    {isSeen && <span className="playlist-item-seen">✓ Látott</span>}
                  </div>
                </div>
                {isAdmin && (
                  <button
                    className="playlist-item-edit"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditVideo(video);
                    }}
                    title="Szerkesztés"
                  >
                    ✏️
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {saving && <div className="saving-indicator">Mentés...</div>}
      </div>
    </div>
  );
}
