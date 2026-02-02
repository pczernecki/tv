# Gyerkoc Video Player - Fejlesztői Útmutató

Ez a dokumentum részletesen leírja a kód felépítését, hogy egy másik fejlesztő vagy AI agent könnyen folytathassa a munkát.

---

## Fájlstruktúra és felelősségek

### `src/App.jsx` - 1293 sor

**Tartalom sorrendben:**

| Sorok | Tartalom |
|-------|----------|
| 1-8 | Import-ok és konstansok |
| 9-28 | Konfigurációs konstansok és auth helper függvények |
| 29-92 | **MockAPI** objektum (localStorage alapú mock backend) |
| 94-148 | **LoginModal** komponens |
| 150-236 | **VideoEditorModal** komponens |
| 238-268 | Helper függvények (loadProgressMap, parseYouTubeVideoId, stb.) |
| 271-296 | **useDisableKeyboard** hook |
| 298-366 | **Mp4Player** komponens |
| 368-540 | **HlsPlayer** komponens |
| 542-688 | **YouTubePlayer** komponens |
| 690-1293 | **App** fő komponens |

---

## Kulcsfontosságú kódrészletek

### 1. MockAPI - Backend absztrakció

```javascript
const MockAPI = {
  async login(username, password) { ... },
  async checkAuth(token) { ... },
  async logout() { ... },
  async getVideos() { ... },
  async saveVideos(videos) { ... },
  async resetVideos() { ... }
};
```

**Hogyan cseréld valódi API-ra:**
```javascript
const RealAPI = {
  async login(username, password) {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) throw new Error('Login failed');
    return res.json();
  },
  // ... többi metódus hasonlóan
};

// Majd cseréld MockAPI -> RealAPI minden előfordulásánál
```

---

### 2. Player Wrapper Pattern

Minden player (Mp4, HLS, YouTube) egy egységes "wrapper" objektumot ad vissza `onReady`-n keresztül:

```javascript
const wrapper = {
  play: () => { ... },
  pause: () => { ... },
  seekTo: (seconds) => { ... },
  getCurrentTime: async () => number,
  getDuration: async () => number,
  isPaused: async () => boolean,
  setOnEnded: (callback) => { ... },
  setOnTime: (callback) => { ... },
  requestFullscreen: () => { ... }
};

onReady(wrapper);
```

Ez lehetővé teszi, hogy az `App` komponens ugyanúgy kezelje az összes player típust.

---

### 3. YouTubePlayer - IFrame API

**Fontos implementációs részletek:**

```javascript
function YouTubePlayer({ videoId, startAt, onReady, onError, onEnded }) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const callbacksRef = useRef({ onReady, onError, onEnded });

  // FONTOS: Callback-ek ref-ben tárolva, hogy ne okozzanak újrarenderelést
  useEffect(() => {
    callbacksRef.current = { onReady, onError, onEnded };
  }, [onReady, onError, onEnded]);

  useEffect(() => {
    let mounted = true;  // Cleanup flag
    
    // 1. API betöltése (csak egyszer)
    // 2. Player létrehozása egyedi div-vel
    // 3. Event listener-ek beállítása
    
    return () => {
      mounted = false;
      // Player cleanup
    };
  }, [videoId, startAt]);  // Csak ezekre renderel újra
}
```

**Miért `callbacksRef`?**
- A callback-ek minden renderben változhatnak
- Ha dependency-ként adnánk meg, a player újraépülne
- Ref-fel frissítjük a callback-et anélkül hogy trigger-elnénk az effect-et

---

### 4. HlsPlayer - Stream kezelés

```javascript
function HlsPlayer({ src, startAt, onReady, onError, onEnded, subtitles }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;

  useEffect(() => {
    // 1. Native HLS támogatás check (Safari)
    if (el.canPlayType('application/vnd.apple.mpegurl')) {
      el.src = src;  // Safari-n natívan megy
    } 
    // 2. hls.js használata
    else if (Hls.isSupported()) {
      const hls = new Hls({
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
      });
      
      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          retryCountRef.current++;
          if (retryCountRef.current >= MAX_RETRIES) {
            onEnded();  // Túl sok hiba, következő videó
          } else {
            hls.startLoad();  // Újrapróbálkozás
          }
        }
      });
    }
    
    // 3. Stall detection (10s timeout)
    let stallTimeout;
    const handleWaiting = () => {
      stallTimeout = setTimeout(() => onEnded(), 10000);
    };
    const handlePlaying = () => {
      clearTimeout(stallTimeout);
    };
  }, [src, ...]);
}
```

---

### 5. Progress mentés logika

```javascript
// Betöltés
function loadProgressMap() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
}

// Mentés (5 másodpercenként)
player.setOnTime?.((ct, dur) => {
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

// Videó vége - jelölés látottnak
player.setOnEnded?.(() => {
  progressData[videoId] = { seen: true, progress: 0, ... };
});
```

---

### 6. Videó váltás flow

```
User kattint playlist item-re
        ↓
selectVideo(video)
        ↓
setCurrent(video)     // Új videó beállítása
setPlayer(null)       // Régi player törlése
setIsPlaying(false)   // Megállítás
setCurrentTime(0)     // Reset
setDuration(0)
        ↓
renderPlayer() újrafut
        ↓
Megfelelő Player komponens renderelése
        ↓
onReady callback → setPlayer(wrapper)
```

---

### 7. Gyerek mód - Billentyű blokkolás

```javascript
function useDisableKeyboard(enabled) {
  useEffect(() => {
    if (!enabled) return;

    const block = (e) => {
      // Input mezőkben engedélyezett
      const tagName = e.target.tagName.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
        return true;
      }
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    document.addEventListener("keydown", block, true);
    document.addEventListener("keyup", block, true);
    document.addEventListener("keypress", block, true);

    return () => {
      document.removeEventListener("keydown", block, true);
      // ...
    };
  }, [enabled]);
}

// Használat
useDisableKeyboard(kidMode && !isAdmin);
```

---

## State Management Diagram

```
                    ┌─────────────────────────────────┐
                    │            App State            │
                    ├─────────────────────────────────┤
                    │ videos: Video[]                 │
                    │ current: Video | null           │
                    │ player: PlayerWrapper | null    │
                    │ isPlaying: boolean              │
                    │ progressMap: Record<id, Progress>│
                    │ isAdmin: boolean                │
                    │ playlistOpen: boolean           │
                    │ showLogin: boolean              │
                    │ editingVideo: Video | null      │
                    │ isNewVideo: boolean             │
                    │ saving: boolean                 │
                    └───────────┬─────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ↓                       ↓                       ↓
┌───────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Mp4Player    │     │   HlsPlayer     │     │  YouTubePlayer  │
│               │     │                 │     │                 │
│ onReady ──────┼─────┼──→ setPlayer()  │     │                 │
│ onEnded ──────┼─────┼──→ jumpToNext() │     │                 │
│ onError ──────┼─────┼──→ skipToNext() │     │                 │
└───────────────┘     └─────────────────┘     └─────────────────┘
```

---

## Event Flow - Videó vége

```
1. Videó lejátszása befejeződik
        ↓
2. Player onEnded callback
        ↓
3. Progress mentése (seen: true)
        ↓
4. pickNextVideo() - Következő nem látott videó kiválasztása
        ↓
5. setCurrent(nextVideo)
        ↓
6. Új player renderelése
```

---

## CSS Trükkök

### Pointer-events átfedés kezelése

Probléma: A kontrollok div-je blokkolta a videó natív kontrolljait.

Megoldás:
```css
.controls {
  pointer-events: none;  /* Div nem fogad egeret */
}

.controls button,
.controls input[type="range"] {
  pointer-events: auto;  /* De az elemek igen */
}
```

### Z-index hierarchia

```css
.media         { z-index: 1; }
.controls      { z-index: 100; }
.bigPlay       { z-index: 100; }
.modal-overlay { z-index: 1000; }
```

---

## Bővítési pontok

### Új videó típus hozzáadása

1. Hozz létre új Player komponenst:
```javascript
function NewPlayer({ src, startAt, onReady, onError, onEnded, subtitles }) {
  // Implementáld a wrapper pattern-t
  const wrapper = { play, pause, seekTo, ... };
  onReady(wrapper);
}
```

2. Add hozzá a `renderPlayer()` függvényhez:
```javascript
if (current.type === "newtype") {
  return <NewPlayer src={current.url} ... />;
}
```

3. Add hozzá a VideoEditorModal select-jéhez:
```jsx
<option value="newtype">New Type</option>
```

### Új admin funkció

1. Adj hozzá state-et az App-hoz
2. Implementáld a logikát
3. Adj hozzá UI elemet (csak `isAdmin` esetén látható)

### Backend cseréje

1. Implementáld ugyanazokat a metódusokat mint MockAPI
2. Cseréld az összes `MockAPI.xxx()` hívást

---

## Tesztelési checklist

- [ ] YouTube videó lejátszása
- [ ] MP4 videó lejátszása
- [ ] HLS stream lejátszása
- [ ] Automatikus ugrás videó végén
- [ ] Progress mentés/visszatöltés
- [ ] Admin bejelentkezés
- [ ] Videó hozzáadása
- [ ] Videó szerkesztése
- [ ] Videó törlése
- [ ] Felirat megjelenítése (YouTube auto)
- [ ] Felirat megjelenítése (VTT)
- [ ] Playlist nyitás/zárás
- [ ] Gyerek mód (billentyű blokkolás)

---

## Ismert limitációk

1. **Nincs offline támogatás** - Minden videó streamelve van
2. **Nincs szerver-oldali progress** - Csak localStorage
3. **Instagram integráció nincs** - Instagram API korlátozások miatt
4. **Automatikus felirat generálás nincs** - Külső szolgáltatás kellene (Whisper, stb.)

---

## Verziókezelés

| Verzió | Változás |
|--------|----------|
| 1.0 | Alap lejátszó YouTube/MP4 támogatással |
| 1.1 | Playlist hozzáadása |
| 1.2 | Admin mód és videó szerkesztés |
| 1.3 | HLS streaming támogatás |
| 1.4 | Felirat támogatás (YouTube + VTT) |
