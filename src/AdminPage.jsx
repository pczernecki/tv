import { useState, useEffect, useCallback } from "react";
import "./AdminPage.css";

const TOKEN_KEY = "admin_token";
const VIDEOS_STORAGE_KEY = "videos_data";
const DELETED_IDS_KEY = "videos_deleted_ids";
const ADMIN_USER = "Gyerkoc";
const ADMIN_PASS = "Gyerkoc123";

// Get token from localStorage
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

// Parse YouTube URL to get video ID
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

// Detect video type from URL
function detectVideoType(url) {
  if (!url) return "youtube";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.endsWith(".m3u8") || url.includes(".m3u8")) return "hls";
  return "mp4";
}

// Mock API for videos
const MockAPI = {
  _getDeletedIds() {
    try {
      return JSON.parse(localStorage.getItem(DELETED_IDS_KEY) || "[]");
    } catch {
      return [];
    }
  },

  _saveDeletedIds(ids) {
    localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(ids));
  },

  async getVideosAndSettings() {
    await new Promise(r => setTimeout(r, 100));
    
    let originalData = { settings: {}, videos: [] };
    try {
      const res = await fetch("/videos.json", { cache: "no-store" });
      const data = await res.json();
      if (Array.isArray(data)) {
        originalData = { settings: {}, videos: data };
      } else {
        originalData = { 
          settings: data.settings || {}, 
          videos: data.videos || [] 
        };
      }
    } catch {
      originalData = { settings: {}, videos: [] };
    }
    
    const originalVideos = originalData.videos;
    const settings = originalData.settings;
    
    let localVideos = [];
    const stored = localStorage.getItem(VIDEOS_STORAGE_KEY);
    if (stored) {
      try {
        localVideos = JSON.parse(stored);
      } catch {}
    }
    
    const deletedIds = this._getDeletedIds();
    
    if (localVideos.length === 0) {
      return { 
        settings, 
        videos: originalVideos.filter(v => !deletedIds.includes(v.id)) 
      };
    }
    
    const localMap = new Map(localVideos.map(v => [v.id, v]));
    const mergedVideos = [...localVideos];
    
    for (const origVideo of originalVideos) {
      if (!localMap.has(origVideo.id) && !deletedIds.includes(origVideo.id)) {
        mergedVideos.push(origVideo);
      }
    }
    
    return { settings, videos: mergedVideos };
  },

  async getVideos() {
    const result = await this.getVideosAndSettings();
    return result.videos;
  },

  async saveVideos(videos) {
    await new Promise(r => setTimeout(r, 200));
    localStorage.setItem(VIDEOS_STORAGE_KEY, JSON.stringify(videos));
    return { success: true };
  },

  async deleteVideo(videoId) {
    const deletedIds = this._getDeletedIds();
    if (!deletedIds.includes(videoId)) {
      deletedIds.push(videoId);
      this._saveDeletedIds(deletedIds);
    }
  },

  async login(username, password) {
    await new Promise(r => setTimeout(r, 300));
    if (username === ADMIN_USER && password === ADMIN_PASS) {
      const token = "mock_token_" + Date.now();
      return { success: true, token };
    }
    throw new Error("Invalid credentials");
  },

  async checkAuth(token) {
    await new Promise(r => setTimeout(r, 100));
    return token && token.startsWith("mock_token_");
  }
};

// Login Component
function LoginForm({ onLogin }) {
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
    } catch {
      setError("Hibás felhasználónév vagy jelszó");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login">
      <h1>🔐 Admin Bejelentkezés</h1>
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
        <button type="submit" disabled={loading}>
          {loading ? "Betöltés..." : "Belépés"}
        </button>
      </form>
    </div>
  );
}

// Add/Edit Video Modal
function VideoModal({ video, onSave, onClose }) {
  const [url, setUrl] = useState(video?.url || "");
  const [title, setTitle] = useState(video?.title || "");
  const [type, setType] = useState(video?.type || "youtube");
  const [mustWatch, setMustWatch] = useState(video?.mustWatch || false);
  const [isProtected, setIsProtected] = useState(video?.protected || false);
  const [subtitles, setSubtitles] = useState(video?.subtitles || "");

  // Auto-detect type when URL changes
  useEffect(() => {
    if (url) {
      setType(detectVideoType(url));
    }
  }, [url]);

  // Auto-fill title from YouTube
  useEffect(() => {
    if (type === "youtube" && url && !title) {
      const vid = parseYouTubeVideoId(url);
      if (vid) {
        setTitle(`YouTube Video (${vid})`);
      }
    }
  }, [url, type, title]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    
    onSave({
      id: video?.id || `video-${Date.now()}`,
      url: url.trim(),
      title: title.trim() || "Névtelen videó",
      type,
      mustWatch,
      protected: isProtected,
      subtitles: subtitles.trim() || undefined,
      createdAt: video?.createdAt || new Date().toISOString(),
      order: video?.order ?? 999
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{video ? "Videó szerkesztése" : "Új videó hozzáadása"}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Videó URL *</label>
            <input
              type="text"
              placeholder="Paste video URL here..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
              required
            />
            <small>YouTube, MP4, vagy HLS (.m3u8) link</small>
          </div>

          <div className="form-group">
            <label>Cím</label>
            <input
              type="text"
              placeholder="Videó címe"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Típus</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="youtube">YouTube</option>
              <option value="mp4">MP4</option>
              <option value="hls">HLS Stream</option>
            </select>
          </div>

          {type !== "youtube" && (
            <div className="form-group">
              <label>Felirat URL (opcionális)</label>
              <input
                type="text"
                placeholder="/videos/subtitles.vtt"
                value={subtitles}
                onChange={(e) => setSubtitles(e.target.value)}
              />
            </div>
          )}

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={mustWatch}
                onChange={(e) => setMustWatch(e.target.checked)}
              />
              ⭐ Must Watch - Új felhasználóknak kötelező
            </label>
          </div>

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={isProtected}
                onChange={(e) => setIsProtected(e.target.checked)}
              />
              🛡️ Védett - Törléshez 3x megerősítés kell
            </label>
          </div>

          <div className="modal-buttons">
            <button type="button" onClick={onClose} className="btn-secondary">
              Mégse
            </button>
            <button type="submit" className="btn-primary">
              Mentés
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Delete Confirmation Modal (for protected videos)
function DeleteConfirmModal({ video, confirmCount, onConfirm, onCancel }) {
  const remaining = 3 - confirmCount;
  
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal delete-modal" onClick={(e) => e.stopPropagation()}>
        <h2>🛡️ Védett videó törlése</h2>
        <p className="video-title">"{video.title}"</p>
        
        {video.mustWatch && (
          <div className="warning">
            ⚠️ Ez egy "Must Watch" videó! Új felhasználóknak kötelező.
          </div>
        )}
        
        <p>
          Ez egy védett videó. A törléshez <strong>{remaining}</strong> további 
          megerősítés szükséges.
        </p>
        
        <div className="confirm-progress">
          {[1, 2, 3].map((i) => (
            <span 
              key={i} 
              className={`confirm-dot ${i <= confirmCount ? 'active' : ''}`}
            >
              {i <= confirmCount ? '✓' : i}
            </span>
          ))}
        </div>
        
        <div className="modal-buttons">
          <button onClick={onCancel} className="btn-secondary">
            Mégse
          </button>
          <button onClick={onConfirm} className="btn-danger">
            {remaining > 0 ? `Megerősítés (${remaining} még hátra)` : "Végleges törlés"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Video List Item
function VideoItem({ video, index, onEdit, onDelete, onMoveUp, onMoveDown, isFirst, isLast }) {
  const thumbnail = video.type === "youtube" 
    ? `https://img.youtube.com/vi/${parseYouTubeVideoId(video.url)}/mqdefault.jpg`
    : null;

  return (
    <div className={`video-item ${video.protected ? 'protected' : ''} ${video.mustWatch ? 'must-watch' : ''}`}>
      <div className="video-order">
        <button 
          onClick={() => onMoveUp(index)} 
          disabled={isFirst}
          className="btn-move"
        >
          ▲
        </button>
        <span className="order-number">{index + 1}</span>
        <button 
          onClick={() => onMoveDown(index)} 
          disabled={isLast}
          className="btn-move"
        >
          ▼
        </button>
      </div>
      
      <div className="video-thumbnail">
        {thumbnail ? (
          <img src={thumbnail} alt={video.title} />
        ) : (
          <div className="thumbnail-placeholder">
            {video.type === "mp4" ? "🎬" : "📺"}
          </div>
        )}
      </div>
      
      <div className="video-info">
        <div className="video-title-row">
          <span className="video-title">{video.title}</span>
          <div className="video-badges">
            {video.mustWatch && <span className="badge must-watch">⭐ Must Watch</span>}
            {video.protected && <span className="badge protected">🛡️ Védett</span>}
          </div>
        </div>
        <div className="video-meta">
          <span className="video-type">{video.type.toUpperCase()}</span>
          <span className="video-url">{video.url.substring(0, 50)}...</span>
        </div>
      </div>
      
      <div className="video-actions">
        <button onClick={() => onEdit(video)} className="btn-edit">
          ✏️
        </button>
        <button onClick={() => onDelete(video)} className="btn-delete">
          🗑️
        </button>
      </div>
    </div>
  );
}

// Main Admin Page
export default function AdminPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [videos, setVideos] = useState([]);
  const [settings, setSettings] = useState({ facebookPageUrl: '' });
  const [loading, setLoading] = useState(true);
  const [editingVideo, setEditingVideo] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirmCount, setDeleteConfirmCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Check auth on mount
  useEffect(() => {
    const token = getToken();
    if (token) {
      MockAPI.checkAuth(token).then((valid) => {
        setIsLoggedIn(valid);
        if (!valid) setToken(null);
      });
    }
  }, []);

  // Load videos and settings
  const loadVideos = useCallback(async () => {
    setLoading(true);
    try {
      const result = await MockAPI.getVideosAndSettings();
      // Sort by order field
      const sorted = [...(result.videos || [])].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
      setVideos(sorted);
      setSettings(result.settings || {});
    } catch {
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      loadVideos();
    }
  }, [isLoggedIn, loadVideos]);

  // Save videos
  const saveVideos = async (newVideos) => {
    setSaving(true);
    try {
      // Update order field based on array position
      const withOrder = newVideos.map((v, i) => ({ ...v, order: i }));
      await MockAPI.saveVideos(withOrder);
      setVideos(withOrder);
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Handle login
  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  // Handle logout
  const handleLogout = () => {
    setToken(null);
    setIsLoggedIn(false);
  };

  // Add/Edit video
  const handleSaveVideo = async (videoData) => {
    let newVideos;
    if (editingVideo) {
      newVideos = videos.map(v => v.id === editingVideo.id ? videoData : v);
    } else {
      newVideos = [...videos, videoData];
    }
    
    const success = await saveVideos(newVideos);
    if (success) {
      setEditingVideo(null);
      setShowAddModal(false);
    }
  };

  // Delete video
  const handleDeleteClick = (video) => {
    if (video.protected) {
      setDeleteTarget(video);
      setDeleteConfirmCount(0);
    } else {
      // Simple confirmation for non-protected
      if (confirm(`Biztosan törlöd: "${video.title}"?`)) {
        performDelete(video);
      }
    }
  };

  const handleDeleteConfirm = () => {
    const newCount = deleteConfirmCount + 1;
    setDeleteConfirmCount(newCount);
    
    if (newCount >= 3) {
      performDelete(deleteTarget);
      setDeleteTarget(null);
      setDeleteConfirmCount(0);
    }
  };

  const performDelete = async (video) => {
    await MockAPI.deleteVideo(video.id);
    const newVideos = videos.filter(v => v.id !== video.id);
    await saveVideos(newVideos);
  };

  // Move video up/down
  const moveVideo = (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= videos.length) return;
    
    const newVideos = [...videos];
    [newVideos[index], newVideos[newIndex]] = [newVideos[newIndex], newVideos[index]];
    saveVideos(newVideos);
  };

  // Back to player
  const goToPlayer = () => {
    window.location.href = "/";
  };

  // Export JSON - clean format for server upload
  const getExportJson = () => {
    // Remove order field and format nicely
    const exportVideos = videos.map(({ order, ...rest }) => rest);
    const exportData = {
      settings: settings,
      videos: exportVideos
    };
    return JSON.stringify(exportData, null, 2);
  };

  // Copy JSON to clipboard
  const copyJsonToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(getExportJson());
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = getExportJson();
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  if (!isLoggedIn) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1>🎬 Videó Adminisztráció</h1>
        <div className="header-actions">
          <button onClick={goToPlayer} className="btn-secondary">
            ← Vissza a lejátszóhoz
          </button>
          <button onClick={handleLogout} className="btn-logout">
            Kijelentkezés
          </button>
        </div>
      </header>

      <div className="admin-toolbar">
        <button onClick={() => setShowAddModal(true)} className="btn-add">
          + Új videó hozzáadása
        </button>
        <button onClick={() => setShowSettingsModal(true)} className="btn-settings">
          ⚙️ Beállítások
        </button>
        <button onClick={loadVideos} className="btn-refresh" disabled={loading}>
          🔄 Frissítés
        </button>
        <button onClick={() => setShowJsonModal(true)} className="btn-export">
          📋 JSON megjelenítés
        </button>
        {saving && <span className="saving-indicator">Mentés...</span>}
      </div>

      <div className="admin-stats">
        <div className="stat">
          <span className="stat-value">{videos.length}</span>
          <span className="stat-label">Összes videó</span>
        </div>
        <div className="stat">
          <span className="stat-value">{videos.filter(v => v.mustWatch).length}</span>
          <span className="stat-label">Must Watch</span>
        </div>
        <div className="stat">
          <span className="stat-value">{videos.filter(v => v.protected).length}</span>
          <span className="stat-label">Védett</span>
        </div>
      </div>

      {loading ? (
        <div className="loading">Betöltés...</div>
      ) : (
        <div className="video-list">
          {videos.length === 0 ? (
            <div className="empty-state">
              <p>Még nincs videó. Adj hozzá egyet!</p>
            </div>
          ) : (
            videos.map((video, index) => (
              <VideoItem
                key={video.id}
                video={video}
                index={index}
                onEdit={setEditingVideo}
                onDelete={handleDeleteClick}
                onMoveUp={() => moveVideo(index, 'up')}
                onMoveDown={() => moveVideo(index, 'down')}
                isFirst={index === 0}
                isLast={index === videos.length - 1}
              />
            ))
          )}
        </div>
      )}

      {/* Add Video Modal */}
      {showAddModal && (
        <VideoModal
          video={null}
          onSave={handleSaveVideo}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* Edit Video Modal */}
      {editingVideo && (
        <VideoModal
          video={editingVideo}
          onSave={handleSaveVideo}
          onClose={() => setEditingVideo(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          video={deleteTarget}
          confirmCount={deleteConfirmCount}
          onConfirm={handleDeleteConfirm}
          onCancel={() => {
            setDeleteTarget(null);
            setDeleteConfirmCount(0);
          }}
        />
      )}

      {/* JSON Export Modal */}
      {showJsonModal && (
        <div className="modal-overlay" onClick={() => setShowJsonModal(false)}>
          <div className="modal json-modal" onClick={(e) => e.stopPropagation()}>
            <h2>📋 videos.json exportálás</h2>
            <p className="json-hint">
              Másold ki ezt a JSON-t és töltsd fel a szerverre a <code>/public/videos.json</code> fájlba.
            </p>
            <div className="json-container">
              <pre className="json-content">{getExportJson()}</pre>
            </div>
            <div className="modal-buttons">
              <button onClick={() => setShowJsonModal(false)} className="btn-secondary">
                Bezárás
              </button>
              <button onClick={copyJsonToClipboard} className="btn-primary">
                {copySuccess ? "✓ Másolva!" : "📋 Másolás vágólapra"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
            <h2>⚙️ Beállítások</h2>
            <div className="form-group">
              <label>Facebook oldal URL</label>
              <input
                type="text"
                placeholder="https://www.facebook.com/oldalad"
                value={settings.facebookPageUrl || ''}
                onChange={(e) => setSettings({ ...settings, facebookPageUrl: e.target.value })}
              />
              <small>Ha be van állítva, megjelenik egy váltógomb a videók és a Facebook feed között.</small>
            </div>
            <div className="modal-buttons">
              <button onClick={() => setShowSettingsModal(false)} className="btn-secondary">
                Bezárás
              </button>
            </div>
            <p className="settings-note">
              💡 A beállítások a JSON exportáláskor mentődnek. Ne felejtsd el exportálni és feltölteni!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
