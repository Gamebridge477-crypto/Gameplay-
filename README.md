# GameBridge

**Connecting Gamers. Building Opportunities. Powering African Esports.**

GameBridge is a full-stack esports ecosystem platform built with React, TypeScript, Tailwind CSS, Express, and SQLite. It connects players, gaming clubs, tournament organizers, and sponsors across Ethiopia and Africa.

## Included Features
- **Landing & Explore Hub:** Ecosystem overview, featured tournaments, popular games, and regional solutions.
- **Authentication & Profiles:** Sign Up, Log In, Log Out, Password Reset Code flow, public profiles, and player blocking.
- **Gamer Dashboard:** Personalized stats, matchmaking recommendations, tournaments, communities, and notifications.
- **Find Players & Teams:** Filter by game, platform, experience, language, city/country, availability, and playstyle; send/accept team invitations.
- **Internet Connection Checker:** Measures download Mbps, upload Mbps, ping ms, and jitter ms against the server with regional relay estimates.
- **Tournaments:** Browse, search, filter, register, create tournaments, and publish results.
- **Gaming Communities:** Join/create clubs, share announcements and scrims, and report content.
- **Opportunities & Organizations:** Sponsorships, equipment access hubs, esports careers, events, and org verification.
- **Admin Dashboard:** Approve tournaments, moderate reports, verify organizations, and manage users/communities.

---

## Publish for Free from GitHub (Render — No Credit Card Required)

This repository includes a `render.yaml` Blueprint so you can publish directly from GitHub on Render's free tier:

1. **Push this project to GitHub** (using AI Studio's **Save to GitHub** / **Download ZIP**).
2. Create a free account on [Render](https://render.com) (sign in with GitHub — no credit card required).
3. Click **New +** → **Blueprint** (or **New Web Service**), and select your GitHub repository.
4. Render automatically detects `render.yaml` (`npm install --include=dev && npm run build` and `npm start`).
5. Click **Apply** / **Create Web Service**. Within ~2 minutes your app is live on `https://<your-service>.onrender.com`.

> **Free-tier note:** On Render's free tier, the server sleeps after 15 minutes of inactivity and resets its local SQLite file (`gamebridge.db`) on restarts/redeploys. For permanent cloud storage without paying, you can connect a free hosted database later.

---

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

### Production Build Test

```bash
npm run build
npm start
```

### Demo Accounts
- **Gamer:** `dawit@gamebridge.et` / `Gamer123!`
- **Organizer:** `selam@abyssiniaesports.et` / `Organizer123!`
- **Admin:** `admin@gamebridge.et` / `Admin123!`
