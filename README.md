# Gyerkoc TV - Video Player - for kids or elders

Vite + React alapú TV-szerű videólejátszó alkalmazás gyerekeknek vagy idősebbeknek, több videóforrás támogatásával.

# Mi ez - röviden?
Végtelenítve játszik le videókat - pont mint egy TV.
Letiltható minden billentyű, így a gyerkőc (vagy idősebb felhasználó) nem lapozza el, nem "rontja el".

# Milyen videókat játszik le és honnan?
Youtube videók vagy a szerver(ek)re feltöltött videók - lehetnek vegyesen is.
Egy egyszerű fáljban beállítható a lejátszandó videók listája és sorrendje.

Az újonnan feltöltött videókat azok, akik már megnézték az előző videókat - automatikusan megkapják, lejátssza azokat.

- YouTube - URL-ből (pl. https://youtube.com/watch?v=...)
- MP4 - /videos/ mappából vagy bármilyen URL-ről
- HLS stream - .m3u8 URL-ek

# Hogyan használható? Egyetlen kattintás - és jön a TV
Egyetlen kattintás szükséges az elején - ez nem kikerülhető mivel automata lejátszást jelenleg nem támogat egyetlen böngésző sem.

## Funkciók - mit tud?

- **Többféle videóforrás**: YouTube, MP4, HLS streaming
- **Automatikus lejátszás**: Videó végén automatikusan ugrik a következőre
- **"Hol tartott" mentés**: localStorage-ban tárolja melyik videót hol hagyta abba - újraindítás után is emlékszik az adott nézőre, hogy hol tartott, nem kell újra néznie mindent
- **Gyerek mód**: Billentyűzet letiltása (nehogy véletlenül elnavigáljon)
- **Felirat támogatás**: YouTube auto-felirat + VTT fájlok MP4/HLS-hez
- **Smart merge**: Új videók automatikusan megjelennek, törölt videók nem jönnek vissza
- **Auto-refresh**: 5 percenként frissíti a videó listát új tartalom kereséséhez
- **Lejátszási lista**: Rejthető oldalsáv a videók listájával

- **Admin mód**: Bejelentkezés után szerkeszthetők a videók


---

## Gyors indítás

```bash
# Függőségek telepítése
npm install

# Fejlesztői szerver indítása
npm run dev

# Production build
npm run build
```

## Backend hosting
Bárhol hostolható! Példák:
Szolgáltatás	Típus	              Ár
Railway	Node.js hosting	Free tier van
Render	       Node.js hosting	       Free tier van
DigitalOcean	Ubuntu VPS	       $4-6/hó
Vercel	       Serverless           Free
Saját szerver	 Bármi	              -
 
A server/ mappában lévő Express szerver bárhol futtatható:
 
cd server
npm install
npm start

Ehhez csak a frontend-ben kell egyszer átírni kb. 1 perc alatt a MockAPI hívásokat fetch-re az igazi URL-re.

---

## Projektstruktúra

```
gyerkocpage/
├── public/
│   └── videos.json          # Videó lista (alap)
├── src/
│   ├── App.jsx              # Fő alkalmazás komponens
│   ├── App.css              # Stílusok
│   └── main.jsx             # React entry point
├── server/                  # Backend (jelenleg nem használt)
│   ├── index.js             # Express szerver
│   └── package.json
├── package.json
└── vite.config.js
```

---

## Architektúra

### Adatfolyam

```
videos.json + localStorage (smart merge)
       ↓
   MockAPI.getVideos()
       ↓
   App state (videos[])
       ↓
   sortByCreatedAtDesc()
       ↓
   Playlist UI + Player
       ↓
   5 percenként auto-refresh
```

### Smart Merge logika

```
1. Letölti videos.json-t (eredeti)
2. Betölti localStorage-t (szerkesztett)
3. Betölti törölt ID-kat
4. Eredmény:
   - localStorage videók maradnak (admin szerkesztések)
   - Új videók videos.json-ból hozzáadódnak
   - Törölt ID-k figyelmen kívül hagyva
```

### Állapotkezelés

Az alkalmazás React `useState` és `useEffect` hookokat használ:

| State | Típus | Leírás |
|-------|-------|--------|
| `videos` | Array | Összes videó listája |
| `current` | Object | Jelenleg játszott videó |
| `player` | Object | Player wrapper (play, pause, seekTo stb.) |
| `isPlaying` | boolean | Lejátszás folyamatban |
| `progressMap` | Object | Videónkénti progress ({seen, progress}) |
| `isAdmin` | boolean | Admin mód aktív |
| `playlistOpen` | boolean | Playlist látható |

---

## Komponensek

### 1. `App` - Fő komponens

A teljes alkalmazás. Tartalmazza:
- Video player renderelését
- Kontrollokat (play/pause, seek, next/prev)
- Playlist sidebar-t
- Admin funkciókat

### 2. `Mp4Player` - MP4 lejátszó

```jsx
<Mp4Player
  src="/videos/film.mp4"       // Videó URL
  startAt={120}                 // Kezdés másodpercben
  subtitles="/videos/film.vtt" // Felirat (opcionális)
  onReady={(player) => {}}     // Player wrapper visszaadása
  onError={(msg) => {}}        // Hiba kezelése
  onEnded={() => {}}           // Videó vége
/>
```

**Player wrapper metódusok:**
- `play()` - Lejátszás
- `pause()` - Megállítás
- `seekTo(seconds)` - Ugrás pozícióra
- `getCurrentTime()` - Jelenlegi pozíció (async)
- `getDuration()` - Teljes hossz (async)
- `isPaused()` - Meg van állítva (async)
- `requestFullscreen()` - Teljes képernyő

### 3. `HlsPlayer` - HLS Stream lejátszó

Ugyanaz az interface mint Mp4Player, plusz:
- `hls.js` könyvtárat használ
- Automatikus újrapróbálkozás hiba esetén (max 3x)
- Stream leállás detektálás (10s timeout)

```jsx
<HlsPlayer
  src="https://example.com/stream.m3u8"
  startAt={0}
  subtitles="/subtitles/stream.vtt"
  onReady={(player) => {}}
  onError={(msg) => {}}
  onEnded={() => {}}
/>
```

### 4. `YouTubePlayer` - YouTube lejátszó

YouTube IFrame Player API-t használ.

```jsx
<YouTubePlayer
  videoId="dQw4w9WgXcQ"       // YouTube video ID
  startAt={30}                 // Kezdés másodpercben
  onReady={(player) => {}}
  onError={(msg) => {}}
  onEnded={() => {}}
/>
```

**Felirat beállítások (automatikusan aktív):**
- `cc_load_policy: 1` - Felirat bekapcsolva
- `cc_lang_pref: 'hu'` - Magyar preferencia
- `hl: 'hu'` - Interface nyelv

### 5. `LoginModal` - Bejelentkezés

Admin bejelentkezési modal.

```jsx
<LoginModal
  onLogin={(token) => {}}     // Sikeres bejelentkezés
  onClose={() => {}}          // Modal bezárása
/>
```

### 6. `VideoEditorModal` - Videó szerkesztő

Videó hozzáadása/szerkesztése/törlése.

```jsx
<VideoEditorModal
  video={null}                 // Szerkesztendő videó (null = új)
  isNew={true}                 // Új videó-e
  onSave={(videoData) => {}}   // Mentés
  onDelete={(videoData) => {}} // Törlés
  onClose={() => {}}           // Bezárás
/>
```

---

## Adatstruktúrák

### Video objektum

```json
{
  "id": "video-123",
  "title": "Videó címe",
  "type": "youtube",           // "youtube" | "mp4" | "hls"
  "url": "https://youtube.com/watch?v=...",
  "subtitles": "/videos/film.vtt",  // Opcionális (csak mp4/hls)
  "createdAt": "2024-01-15T10:00:00Z"
}
```

### Progress objektum (localStorage)

```json
{
  "video-123": {
    "seen": false,
    "progress": 145.5,
    "updatedAt": 1705312800000
  }
}
```

---

## API (MockAPI)

Jelenleg localStorage-alapú mock, könnyen cserélhető valódi backend-re.

### Metódusok

```javascript
// Bejelentkezés
await MockAPI.login(username, password)
// Returns: { success: true, token: "mock_token_..." }

// Token ellenőrzés
await MockAPI.checkAuth(token)
// Returns: boolean

// Kijelentkezés
await MockAPI.logout()
// Returns: { success: true }

// Videók lekérése (smart merge-el)
await MockAPI.getVideos()
// Returns: Video[] (merged: localStorage + új videos.json - törölt)

// Videók mentése
await MockAPI.saveVideos(videos)
// Returns: { success: true }

// Videó törlése (ID mentése, hogy ne jöjjön vissza)
await MockAPI.deleteVideo(videoId)
// Menti a törölt ID-t localStorage-ba

// Reset eredeti videókra
await MockAPI.resetVideos()
// Returns: Video[] (törli localStorage-t és deleted IDs-t is)
```

### Valódi backend-re váltás

A `server/` mappában van egy kész Express szerver. Használatához:

1. Indítsd el a szervert:
```bash
cd server
npm install
npm start
```

2. Cseréld a MockAPI hívásokat fetch hívásokra az `App.jsx`-ben:

```javascript
// MockAPI.login helyett:
const res = await fetch('http://localhost:3001/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password })
});
const data = await res.json();
```

---

## localStorage kulcsok

| Kulcs | Tartalom |
|-------|----------|
| `kid_player_progress_v1` | Progress map (melyik videót hol hagyta abba) |
| `admin_token` | Bejelentkezési token |
| `videos_data` | Szerkesztett videó lista |
| `videos_deleted_ids` | Törölt videó ID-k (hogy ne jöjjenek vissza merge-nél) |

---

## Gyerek mód

A `useDisableKeyboard` hook letiltja a billentyűket, hogy a gyerek ne navigáljon el véletlenül.

**Kivételek:**
- Input mezőkben (login, szerkesztő) engedélyezett a gépelés
- Admin módban kikapcsol

```javascript
const DEFAULT_KID_MODE = true;  // Alapból bekapcsolva
```

---

## Felirat támogatás

### YouTube
Automatikusan bekapcsol ha elérhető. A beállítások:
```javascript
playerVars: {
  cc_load_policy: 1,  // Bekapcsolás
  cc_lang_pref: 'hu', // Magyar preferencia
  hl: 'hu'            // Interface nyelv
}
```

### MP4/HLS - VTT fájlok

1. Készíts VTT fájlt:
```vtt
WEBVTT

00:00:01.000 --> 00:00:04.000
Ez az első felirat.

00:00:05.000 --> 00:00:08.000
Ez a második felirat.
```

2. Add hozzá a videóhoz:
```json
{
  "type": "mp4",
  "url": "/videos/film.mp4",
  "subtitles": "/videos/film.vtt"
}
```

---

## CSS struktúra

### Fő osztályok

| Osztály | Leírás |
|---------|--------|
| `.app` | Fő container |
| `.stage` | Videó terület |
| `.media` | Video elem |
| `.controls` | Kontroll gombok |
| `.playlist-sidebar` | Oldalsó lista |
| `.modal-overlay` | Modal háttér |
| `.modal` | Modal ablak |

### Z-index rétegek

```
1    - .media (videó)
100  - .controls (kontrollok)
100  - .playlist-toggle
1000 - .modal-overlay
```

### Fontos CSS trükk

A kontrollok `pointer-events: none` beállítással működnek, hogy ne blokkolják a videó natív kontrolljait:

```css
.controls {
  pointer-events: none;  /* Átenged egéreseményeket */
}

.controls button,
.controls input {
  pointer-events: auto;  /* De a gombok kattinthatók */
}
```

---

## Hibakezelés

### Videó hiba esetén
1. Logol konzolra
2. Jelöli látottnak (error: true)
3. Ugrik következő videóra

### HLS stream leállás
1. 3x újrapróbálkozás
2. 10 másodperc timeout
3. Ugrik következőre

### YouTube hiba
- API hiba: következő videó
- Érvénytelen URL: következő videó

---

## Testreszabás

### Admin hitelesítő adatok

```javascript
// App.jsx tetején
const ADMIN_USER = "Gyerkoc";
const ADMIN_PASS = "Gyerkoc123";
```

### Gyerek mód kikapcsolása

```javascript
const DEFAULT_KID_MODE = false;
```

### Auto-refresh intervallum

```javascript
// App.jsx tetején - alapértelmezett 5 perc
const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000;

// Más értékek:
// 1 * 60 * 1000   = 1 perc
// 10 * 60 * 1000  = 10 perc
// 30 * 1000       = 30 másodperc (teszteléshez)
```

### Felirat nyelv változtatása

```javascript
// YouTubePlayer-ben
cc_lang_pref: 'en',  // Angol
hl: 'en'

// Mp4Player/HlsPlayer-ben
<track srcLang="en" label="English" />
```

---

## Függőségek

```json
{
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "hls.js": "^1.6.15"
}
```

---

## Gyakori problémák

### YouTube "Playback paused" hiba
Ez YouTube fiók szintű korlátozás (pl. Premium limit). Nem a kód hibája.

### Felirat nem jelenik meg YouTube-on
A videónak kell hogy legyen felirata (feltöltött vagy auto-generált).

### HLS stream nem indul
Ellenőrizd:
- CORS beállítások
- Stream URL elérhetősége
- Böngésző támogatás

---

## Licensz

Privát projekt.

