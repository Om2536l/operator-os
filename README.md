# Operator OS — Setup Guide

A personal Digital Discipline PWA. Works offline. Syncs to your Google Drive.

---

## Files

```
discipline-os/
├── index.html       ← Main app shell
├── style.css        ← All styles
├── app.js           ← All logic (checklist, timer, stats, reflect, Drive)
├── manifest.json    ← Makes it installable as PWA on Android
├── sw.js            ← Service worker (offline support)
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

---

## Option A — Run locally (no hosting needed)

1. Put the entire `discipline-os/` folder on your computer or Android device.
2. Open `index.html` in Chrome.
3. That's it. Everything runs locally. Data saves in browser localStorage.

**Install on Android from Chrome:**
- Open the folder via a local server or file:// URL
- Chrome will show "Add to Home Screen" → tap it
- App installs with icon, works offline like a native app

**Quickest local server (run in the folder):**
```bash
python3 -m http.server 8080
```
Then open `http://localhost:8080` in Chrome on your PC, or your phone's browser
at `http://YOUR_PC_IP:8080` (same WiFi).

---

## Option B — Host on GitHub Pages (free, always accessible)

1. Create a GitHub account if you don't have one.
2. Create a new repository (e.g. `operator-os`), make it **public**.
3. Upload all files in `discipline-os/` to the repo root.
4. Go to repo Settings → Pages → Source: main branch → Save.
5. Your app is live at: `https://YOUR_USERNAME.github.io/operator-os/`
6. Open that URL in Chrome on your Android → tap ⋮ → "Add to Home Screen".

This is the recommended approach. Free hosting, accessible from any device,
installable as a PWA.

---

## Option C — Enable Google Drive Sync

This stores your data as `operator_os_data.json` in your own Google Drive.

### Step 1 — Create a Google Cloud project
1. Go to https://console.cloud.google.com
2. Create a new project (e.g. "Operator OS")
3. Go to "APIs & Services" → "Enable APIs" → search "Google Drive API" → Enable

### Step 2 — Create OAuth credentials
1. "APIs & Services" → "Credentials" → "Create Credentials" → "OAuth Client ID"
2. Application type: **Web application**
3. Name: Operator OS
4. Authorized JavaScript origins: add your app URL
   - If GitHub Pages: `https://YOUR_USERNAME.github.io`
   - If localhost: `http://localhost:8080`
5. Authorized redirect URIs: same as above
6. Click Create → copy your **Client ID**

### Step 3 — Add Client ID to app
Open `app.js`, find line:
```js
const DRIVE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID';
```
Replace with your actual Client ID:
```js
const DRIVE_CLIENT_ID = '123456789-abc.apps.googleusercontent.com';
```

### Step 4 — Configure OAuth consent screen
1. "APIs & Services" → "OAuth consent screen"
2. User type: External (for personal use)
3. Fill app name, your email
4. Add scope: `https://www.googleapis.com/auth/drive.file`
5. Add yourself as a test user

### Done
- Tap the Drive icon (top right) in the app
- Sign in with your Google account
- Data syncs to `operator_os_data.json` in your Drive root

---

## Data format

All data is plain JSON in localStorage (and optionally Drive):

```json
{
  "days": {
    "2026-06-10": {
      "habits": {
        "morning_lock": true,
        "lecture_mode": false,
        ...
      },
      "focusMin": 50,
      "sessions": 2
    }
  },
  "reflections": [
    {
      "week": "Week 23 · June 9–15",
      "date": "2026-06-10T...",
      "break": "...",
      "trigger": "...",
      "fix": "...",
      "good": "..."
    }
  ]
}
```

---

## Customizing habits

Edit the `HABITS` array in `app.js`:

```js
const HABITS = [
  { id: 'morning_lock', label: 'Morning lock held (+60 min)' },
  { id: 'lecture_mode', label: 'Phone off during lectures' },
  // add or remove entries here
];
```

Each habit needs a unique `id` (no spaces) and a display `label`.

---

## Customizing Pomodoro durations

In `app.js`, find the timer object and change:
```js
WORK_SEC:  25 * 60,   // 25 minutes work
BREAK_SEC:  5 * 60,   // 5 minutes break
```

---

Built with: HTML + CSS + Vanilla JS. No frameworks. No dependencies.
~600 lines of code total. Fully yours.
