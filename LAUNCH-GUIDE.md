# CLUTCH — Launch Guide (for total beginners)

This guide takes you from a folder of files to a **live website that auto-updates and sends
phone alerts**, with zero coding background assumed. Read it top to bottom. Copy-paste the
commands exactly. Where you see `like this`, that's something to type or click.

There are two finish lines:

- **Finish line A — a live web app** (this week). A real website on the internet that updates
  scores by itself and can send alerts to phones. **No Apple/Google accounts, no app-store wait.**
- **Finish line B — a real app-store app** (later). The same thing wrapped as a downloadable
  iPhone/Android app. Needs paid developer accounts and a review wait. Covered at the end.

Start with A. It's 90% of the value and you can share it the day it's live.

---

## What you have in this folder

You don't need to understand these, but here's the map:

- `server.js` — the always-on "brain." Watches every live game, scores it, sends alerts.
- `clutch.js` — the rule for what counts as a must-watch game.
- `espn.js` — pulls live scores from ESPN's free feed.
- `public/` — the actual app people see (the web page + the bit that shows phone notifications).
- `package.json` — the list of building blocks your app needs.
- `generate-keys.js` — makes your secret "alert keys" (one-time).

---

# PART 1 — Get it running on your own computer first

This proves it works before you put it online. ~15 minutes.

### Step 1.1 — Install Node.js

Node is the engine that runs the app.

1. Go to **https://nodejs.org**
2. Download the big green **"LTS"** button.
3. Open the downloaded file and click through the installer (all defaults are fine).
4. To confirm it worked: open your **Terminal** (Mac: press Cmd+Space, type `Terminal`, Enter /
   Windows: press the Start key, type `cmd`, Enter) and type:
   ```
   node --version
   ```
   If you see a number like `v20.x.x` or `v22.x.x`, you're good.

### Step 1.2 — Open this folder in the Terminal

In the Terminal, type `cd ` (the letters c, d, then a space — don't press Enter yet), then **drag
the CLUTCH folder onto the Terminal window** and let go. It pastes the location. Press Enter.

You're now "inside" the folder.

### Step 1.3 — Install the building blocks

Type this and press Enter (it downloads what the app needs; takes a minute):
```
npm install
```

### Step 1.4 — Make your alert keys (one time)

Type:
```
npm run keys
```
It prints two lines that look like `VAPID_PUBLIC_KEY=BIga...` and `VAPID_PRIVATE_KEY=k3jf...`.
**Keep this Terminal window open** — you'll copy these in a second. (The private one is a secret;
don't post it anywhere.)

### Step 1.5 — Create your settings file

In the CLUTCH folder, find the file named `.env.example`. Make a copy of it and rename the copy to
exactly `.env` (just those four characters: dot, e, n, v). Open `.env` in any text editor
(TextEdit / Notepad) and paste your two keys after the `=` signs, so it looks like:
```
VAPID_PUBLIC_KEY=BIga...(your long public key)
VAPID_PRIVATE_KEY=k3jf...(your long private key)
VAPID_SUBJECT=mailto:youremail@example.com
LEAGUES=baseball,basketball,wnba,hockey,football,soccer
POLL_MS=20000
```
Save the file.

### Step 1.6 — Run it!

Back in the Terminal, type:
```
npm start
```
You'll see `CLUTCH running on http://localhost:3000`. Open your web browser and go to:
```
http://localhost:3000
```
**That's your app, running live on your own machine, pulling real games.** If games are happening,
you'll see them ranked by clutch score. To stop it later, click the Terminal and press `Ctrl + C`.

> Tip: tap the 🔔 button to test alerts. On a computer you'll get browser notifications. Real
> phone lock-screen alerts happen once it's online (Part 2) and added to your phone (Part 4).

---

# PART 2 — Put it LIVE on the internet (Finish line A)

We'll use **Render.com** — it's free to start and the friendliest for beginners. ~20 minutes.

### Step 2.1 — Put the code on GitHub

GitHub is where your code lives so Render can grab it.

1. Make a free account at **https://github.com**.
2. Install **GitHub Desktop** from **https://desktop.github.com** (the no-typing way to use GitHub).
3. Open GitHub Desktop → **File → Add Local Repository** → choose your CLUTCH folder. If it asks to
   "create a repository," say yes. Give it the name `clutch`. Keep it **Private** if you prefer.
4. Click **Publish repository** (top right). Done — your code is on GitHub.

### Step 2.2 — Deploy on Render

1. Make a free account at **https://render.com** (sign in with GitHub — one click).
2. Click **New +** → **Web Service**.
3. Connect your `clutch` repository when it asks.
4. Fill in:
   - **Name:** `clutch` (this becomes part of your web address)
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** **Free**
5. Scroll to **Environment Variables** → add these (click "Add" for each):
   - `VAPID_PUBLIC_KEY` = your public key from Step 1.4
   - `VAPID_PRIVATE_KEY` = your private key from Step 1.4
   - `VAPID_SUBJECT` = `mailto:youremail@example.com`
   - `LEAGUES` = `baseball,basketball,wnba,hockey,football,soccer`
6. Click **Create Web Service**. Wait ~2–3 minutes.

When it's done, Render gives you a live address like `https://clutch.onrender.com`.
**Open it. That's your app, live on the internet, that anyone can visit.** 🎉

> One Render free-tier quirk: if nobody visits for ~15 minutes, the server "sleeps" and the next
> visit takes ~30 seconds to wake up. That also pauses alert-watching while asleep. When you're
> ready for always-on (needed for reliable alerts), upgrade to Render's cheapest paid tier
> (about $7/month) — one click, no code change.

---

# PART 3 — Use your own name/domain (optional, ~$12/year)

1. Buy a domain at **https://namecheap.com** or **https://porkbun.com** (e.g. `clutchsports.app`).
2. In Render: open your service → **Settings → Custom Domains → Add** your domain.
3. Render shows you a couple of DNS records. Copy them into your domain seller's DNS settings
   (they all have a "DNS" or "Advanced DNS" page; paste the records Render gave you).
4. Wait a bit (can be minutes to a few hours). Your app now lives at your own web address, with a
   secure padlock automatically.

---

# PART 4 — Put it on your phone + turn on alerts (no app store needed)

This is the magic part, and it works **right now** with what you've built — no Apple/Google account.

### On iPhone (must be iOS 16.4 or newer)
1. Open **Safari** and go to your live address (e.g. `https://clutch.onrender.com`).
2. Tap the **Share** button (the square with the up-arrow) → **Add to Home Screen** → **Add**.
3. Open CLUTCH from the new **home-screen icon** (this step matters — iPhone only allows alerts
   when it's opened from the home screen, not from Safari).
4. Tap **🔔 Alerts** → **Allow** when asked.
5. That's it. Now when a game gets good, your phone buzzes on the lock screen — even with the app
   closed.

### On Android
1. Open **Chrome** and go to your live address.
2. Tap the menu (⋮) → **Install app** (or **Add to Home screen**).
3. Open it, tap **🔔 Alerts** → **Allow**.
4. Done — lock-screen alerts, app closed or not.

> Want to test an alert immediately without waiting for a close game? With your phone subscribed,
> visit `https://YOUR-ADDRESS/api/test-alert` in a browser — it pushes a test ping to every
> subscribed device.

**At this point you are fully live:** a real web app, auto-updating, installable on phones, sending
real alerts. You can share the link anywhere.

---

# PART 5 — Turn it into a real App Store / Play Store app (Finish line B)

Only do this once people are using the web app and you want store presence. The app is the *same*
code wrapped in a downloadable shell using a free tool called **Capacitor**. The code work is small;
the accounts and review are the real steps.

What it takes (this part needs **you**, because the accounts are tied to your identity):

1. **Apple Developer account** — **$99/year** (https://developer.apple.com). Required to put
   anything in Apple's App Store.
2. **Google Play Developer account** — **$25 once** (https://play.google.com/console).
3. **Wrap the app** with Capacitor (a few commands; ask me and I'll generate the exact steps and
   config for your project).
4. **Submit for review.** Apple and Google both review apps before they go live —
   usually 1–3 days, and they can ask for changes.
5. For app-store push notifications, Apple/Google use their own push systems; Capacitor has a
   ready-made plugin and I can wire it in when you're at this stage.

Honest advice: **most of CLUTCH's value doesn't need the app store at all.** The installable web app
(Part 4) already does lock-screen alerts. Treat the store version as a later "nice to have," not a
blocker to launching.

---

# What this costs

| Stage | Cost |
|---|---|
| Run on your computer | Free |
| Live web app (Render free tier) | Free (sleeps when idle) |
| Always-on web app (reliable alerts) | ~$7/month |
| Custom domain | ~$12/year |
| Live scores data (ESPN free feed) | Free |
| Apple App Store account | $99/year (only for store app) |
| Google Play account | $25 once (only for store app) |

You can be genuinely live for **$0**, and reliably-always-on for **about $7/month**.

---

# Honest cautions (so nothing surprises you)

- **The free ESPN feed has no guarantee.** It's the same data ESPN's own site uses, but it's
  undocumented — they could change it and the app would need a fix. For a paid, contracted feed
  later, look at **SportsDataIO**, **API-Sports**, or **The Odds API** (for betting lines). Ask me
  and I'll swap the data source — only `espn.js` changes.
- **"Where to watch" can be imperfect for local games.** National TV is reliable; regional and
  blackout situations are messy everywhere (even ESPN). The app shows what the feed provides.
- **Reliable alerts need an always-on server** (the ~$7/month tier). The free tier sleeps, so it's
  great for showing people, but bump it up before you depend on the pings.
- **Saved subscriptions reset on the free tier** when the server restarts. For a real user base,
  store them in a free database (Render has one; I can wire it in when you're ready).

---

# Stuck? Common fixes

- **"npm: command not found"** → Node didn't install; redo Step 1.1 and reopen the Terminal.
- **Page loads but no games** → there may be no live games right now; also the free Render server
  may be waking up (wait 30s and refresh).
- **iPhone alert button does nothing** → you must open CLUTCH from the **home-screen icon**, not
  Safari, and be on iOS 16.4+.
- **Alerts never arrive** → check the env keys are set on Render exactly as generated, and that the
  server isn't asleep (free tier). Try the `/api/test-alert` trick in Part 4.

---

When you want to do Finish line B, swap the data feed, add a settings screen for each user's own
thresholds, or store subscriptions in a database — come back and I'll generate exactly what you need.
