# Gyerkoc Video Player - Backend Server

## Status: NOT IN USE

The frontend currently uses **MockAPI** (localStorage) for all data operations.
This server code is ready for when you want to switch to a real backend.

## How to enable the real backend

### 1. Install dependencies
```bash
cd server
npm install
```

### 2. Start the server
```bash
npm start
```
Server runs on `http://localhost:3001`

### 3. Update frontend to use real API

In `src/App.jsx`, replace `MockAPI` calls with real fetch calls:

```javascript
// Replace this:
const data = await MockAPI.login(username, password);

// With this:
const res = await fetch('http://localhost:3001/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password })
});
const data = await res.json();
```

Or create a `RealAPI` object that mirrors `MockAPI` structure.

## API Endpoints

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | `/api/login` | No | Login with username/password, returns token |
| POST | `/api/logout` | Yes | Invalidate token |
| GET | `/api/check-auth` | Yes | Verify if token is valid |
| GET | `/api/videos` | No | Get videos list |
| POST | `/api/videos` | Yes | Save videos list |

## Credentials

Default admin credentials (change in production!):
- Username: `Gyerkoc`
- Password: `Gyerkoc123`
