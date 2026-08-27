# RootSignal

**Automatic root cause analysis for production errors — powered by AI and Git history.**

When Sentry fires an alert, RootSignal correlates it against your recent GitHub commits, generates an AI hypothesis for the root cause, and delivers a rich Slack notification with the suspect commit and next steps — before your team even opens a terminal.

---

## The problem it solves

When a production error fires, engineers waste 20–40 minutes on the same questions every time:
- Which deploy caused this?
- Which commit is the likely culprit?
- What's the fastest path to a fix?

RootSignal answers all three automatically, in under 10 seconds.

---

## How it works

```
Sentry Error Webhook
        │
        ▼
  HMAC Verification          ← rejects tampered/unsigned payloads
        │
        ▼
  Payload Extraction         ← issue ID, timestamp, message, stack trace files
        │
        ▼
  GitHub Commits Fetch       ← retrieves commits within the error time window
        │
        ▼
  Correlation Scoring        ← heuristic: time proximity (60pts) + file overlap (40pts)
        │
        ▼
  AI Root Cause Generation   ← Gemini 2.0 Flash → Groq fallback (3-sentence hypothesis)
        │
        ▼
  Slack Alert                ← Block Kit card: hypothesis + suspect commit + action buttons
        │
        ▼
  PostgreSQL Storage         ← incident saved, MTTR tracked on resolution
        │
        ▼
  Dashboard                  ← Next.js UI: incidents, stats, AI hypotheses, resolve flow
```

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express (ES modules) |
| Database | Neon PostgreSQL |
| AI | Google Gemini 2.0 Flash + Groq (llama-3.3-70b) fallback |
| Frontend | Next.js 14, React 18, Tailwind CSS |
| Integrations | Sentry Webhooks, GitHub REST API, Slack Block Kit |
| CI/CD | GitHub Actions → Render (backend) + Vercel (frontend) |

---

## Project structure

```
RootSignal/
├── backend/
│   ├── src/
│   │   ├── index.js                  # Express server entrypoint
│   │   ├── db/
│   │   │   ├── client.js             # Neon PostgreSQL connection pool
│   │   │   └── migrate.js            # Schema migration (incidents, teams tables)
│   │   ├── routes/
│   │   │   ├── sentry.route.js       # POST /webhooks/sentry — full ingestion pipeline
│   │   │   ├── sentry.middleware.js  # HMAC-SHA256 signature verification
│   │   │   ├── sentry.validator.js   # Payload parsing and validation
│   │   │   └── incidents.route.js    # GET /api/incidents, PATCH /api/incidents/:id
│   │   └── services/
│   │       ├── correlator.service.js # Commit ↔ error correlation scoring
│   │       ├── ai.service.js         # Gemini / Groq root cause generation
│   │       ├── github.service.js     # GitHub API — commits and diffs
│   │       ├── incident.service.js   # DB CRUD + MTTR calculation
│   │       └── slack.service.js      # Slack Block Kit alert formatting
│   └── scripts/                      # Diagnostic and integration test scripts
├── frontend/
│   ├── app/
│   │   ├── page.js                   # Dashboard (auto-refresh every 30s)
│   │   ├── layout.js                 # Root layout
│   │   └── api/incidents/            # Next.js route handlers proxying to backend
│   └── components/
│       ├── IncidentCard.js           # Incident card with AI hypothesis + resolve flow
│       └── StatsBar.js               # Summary metrics bar
└── .github/workflows/
    ├── deploy.yml                    # Deploy to Render + Vercel on push to main
    └── pr-check.yml                  # Syntax validation on pull requests
```

---

## Local setup

### Prerequisites
- Node.js 18+
- A Neon PostgreSQL database
- A Sentry project with webhook support
- A GitHub personal access token (repo scope)
- A Slack app with `chat:write` permission
- A Google AI Studio API key (Gemini) or Groq API key

### 1. Clone the repo

```bash
git clone https://github.com/joshcodz/RootSignal.git
cd RootSignal
```

### 2. Set up the backend

```bash
cd backend
npm install
cp .env.example .env   # fill in your values
npm run migrate        # creates the incidents and teams tables
npm run dev            # starts Express on PORT (default 3001)
```

### 3. Set up the frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL
npm run dev                  # starts Next.js on localhost:3000
```

### 4. Configure Sentry webhook

In your Sentry project → Settings → Integrations → Webhooks:
- URL: `https://your-backend-url/webhooks/sentry`
- Copy the signing secret into `SENTRY_WEBHOOK_SECRET` in your `.env`

---

## Environment variables

### Backend (`backend/.env`)

```env
# Database
DATABASE_URL=your_neon_postgres_connection_string

# Sentry
SENTRY_WEBHOOK_SECRET=your_sentry_webhook_signing_secret

# GitHub
GITHUB_ACCESS_TOKEN=your_github_personal_access_token
GITHUB_REPO=owner/repo-name

# AI
GEMINI_API_KEY=your_google_ai_studio_key
GROQ_API_KEY=your_groq_api_key

# Slack
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_CHANNEL_ID=your_slack_channel_id

# Server
PORT=3001
FRONTEND_URL=http://localhost:3000
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## Diagnostic scripts

Run these to verify each integration independently before testing the full pipeline:

```bash
cd backend

node scripts/check-env.js          # verify env vars are loaded
node scripts/test-db.js            # verify Neon DB connection
node scripts/test-github.js        # verify GitHub API + commit fetching
node scripts/test-ai.js            # verify Gemini/Groq root cause generation
node scripts/test-slack.js         # send a sample Slack alert
node scripts/test-sentry-webhook.js # simulate a signed Sentry webhook
node scripts/test-full-pipeline.js  # end-to-end integration test
```

---

## API reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/healthz` | Health check |
| POST | `/webhooks/sentry` | Ingest a Sentry error event |
| GET | `/api/incidents` | Fetch all incidents |
| PATCH | `/api/incidents/:id` | Mark an incident as resolved |

---

## Deployment

The project deploys automatically via GitHub Actions on push to `main`:
- **Backend** → [Render](https://render.com)
- **Frontend** → [Vercel](https://vercel.com)

Set all environment variables in your Render and Vercel dashboards before deploying.

---

## What I'd build next

- **Multi-repo support** — the `teams` table is already in the schema, the service layer isn't wired up yet
- **Automated unit tests** — correlator scoring logic and payload validation are good candidates for Vitest
- **Confidence threshold alerts** — only ping Slack when correlation score exceeds a configurable threshold, reducing noise
- **Weekly MTTR digest** — scheduled Slack summary of incident trends and resolution time

---

*Built by Josh (joshcodz)*
