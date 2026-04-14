#  Zomato Voice Support Agent — Frontend

A real-time voice-powered customer support interface for Zomato, built with **Next.js 16**, **React 19**, and the **Gemini Multimodal Live API**. Users can call a live AI voice agent directly from the browser to resolve order issues, request refunds, and file complaints — all through natural conversation.

<br>

##  Features

| Feature | Description |
|---|---|
| **Live Voice Agent** | Real-time, bidirectional voice calls powered by Gemini's Multimodal Live API via WebSocket |
| **iOS-Inspired UI** | Frosted glass headers, smooth animations, and a mobile-first design language |
| **Wallet & Orders Dashboard** | View wallet balance, active orders, and full order history at a glance |
| **In-Call Transcript** | Live text transcript displayed during voice calls for transparency |
| **User Switching** | Instantly switch between test user accounts to demo different customer profiles |
| **Database Seeding** | One-click seed button to populate MongoDB with realistic test data |
| **Refund Workflow** | LTV-based smart refunds with a 2-hour delivery window policy |
| **Complaint Filing** | File structured complaints across six categories (food quality, late delivery, etc.) |
| **Toast Notifications** | Non-intrusive feedback for all user actions |

<br>

##  Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                        │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌────────────────────┐  │
│  │   React UI   │    │  API Routes  │    │   MongoDB Client   │  │
│  │  (app/page)  │◄──►│  /api/*      │◄──►│   (Mongoose)       │  │
│  └──────┬───────┘    └──────────────┘    └────────────────────┘  │
│         │                                                        │
│         │ WebSocket (PCM audio)                                  │
│         ▼                                                        │
│  ┌──────────────────────────────┐                                │
│  │  Voice Agent Server (Python) │◄──► Gemini Live API            │
│  │  FastAPI + WebSocket Proxy   │     (Bidirectional Streaming)  │
│  └──────────────────────────────┘                                │
└──────────────────────────────────────────────────────────────────┘
```

<br>

##  Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router)
- **UI Library:** [React 19](https://react.dev/)
- **Language:** TypeScript
- **Database:** [MongoDB Atlas](https://www.mongodb.com/atlas) via Mongoose
- **Styling:** Vanilla CSS with iOS-inspired design system (Inter font, glassmorphism, CSS animations)
- **Voice:** WebSocket → [Gemini Multimodal Live API](https://ai.google.dev/gemini-api/docs/multimodal-live) (PCM 16-bit audio @ 16kHz)
- **Deployment:** Vercel (frontend) · Google Cloud Run (voice server)

<br>

##  Project Structure

```
frontend/
├── app/
│   ├── api/                    # Next.js API routes (server-side)
│   │   ├── orders/[userId]/    # GET — fetch orders by user
│   │   ├── users/[id]/         # GET — fetch user profile
│   │   ├── seed/               # POST — seed database with test data
│   │   └── support/refund/     # POST — initiate refund
│   ├── globals.css             # iOS-inspired design system & animations
│   ├── layout.tsx              # Root layout with Inter font + metadata
│   └── page.tsx                # Main SPA — dashboard, voice call overlay
├── lib/
│   ├── models.ts               # Mongoose schemas (User, Order, SupportTicket, Complaint)
│   └── mongodb.ts              # Cached MongoDB connection handler
├── .env                        # Environment variables (not committed)
├── next.config.ts              # Next.js configuration
├── package.json
└── tsconfig.json
```

<br>

##  Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- A **MongoDB Atlas** cluster (or local MongoDB instance)
- The [Voice Agent Server](../voice_agent_server/) running and accessible

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the `frontend/` directory:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?appName=<app>
NEXT_PUBLIC_VOICE_AGENT_URL=wss://<your-voice-server-host>/ws/voice
```

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB connection string used by API routes for data access |
| `NEXT_PUBLIC_VOICE_AGENT_URL` | WebSocket URL of the voice agent server (falls back to `ws://localhost:8080/ws/voice`) |

### 3. Seed the Database

Start the dev server and click **↻ Seed DB** in the wallet card, or hit the API directly:

```bash
curl -X POST http://localhost:3000/api/seed
```

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

<br>

##  Voice Call Flow

1. User clicks **"Call Voice Agent"** → browser requests microphone access.
2. A WebSocket connection opens to the voice agent server, passing the current `user_id`.
3. Microphone audio is captured via `ScriptProcessorNode`, converted to **16-bit PCM**, and streamed over the WebSocket.
4. The voice server proxies audio to **Gemini's Multimodal Live API**, which responds with audio and tool calls.
5. Audio responses (24kHz PCM) are decoded and queued for gapless playback via `AudioContext`.
6. Text transcripts and tool execution statuses are displayed in the call overlay in real-time.
7. User clicks **"End Call"** → WebSocket closes, microphone released, overlay dismissed.

<br>

##  API Routes

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/users/[id]` | Fetch a user profile by numeric ID |
| `GET` | `/api/orders/[userId]` | Fetch all orders for a user, sorted by most recent |
| `POST` | `/api/seed` | Wipe and re-seed the database with 5 test users and ~20 orders |
| `POST` | `/api/support/refund` | Initiate a refund for a specific order (`{ user_id, order_id, reason }`) |

<br>

## 🎨 Design System

The UI follows an **iOS-inspired design language** defined in `globals.css`:

- **Color Palette:** Zomato red accent (`#E23744`), iOS system greens, blues, oranges
- **Typography:** [Inter](https://fonts.google.com/specimen/Inter) via `next/font`
- **Glassmorphism:** Frosted glass header with `backdrop-filter: blur(20px)`
- **Micro-animations:** Pulse indicator for active calls, shimmer loading states, fade-slide-in transcripts
- **Call Overlay:** Full-screen dark overlay with concentric ring visualizer mimicking a native phone call UI
- **Responsive:** Mobile-first layout capped at 480px with a rounded card on desktop viewports

<br>

##  Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server with hot reload |
| `npm run build` | Create an optimized production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint checks |

<br>

## 🚢 Deployment

### Vercel (Recommended)

1. Push the `frontend/` directory to a Git repository.
2. Import the project on [Vercel](https://vercel.com/new).
3. Set the **Root Directory** to `frontend`.
4. Add `MONGODB_URI` and `NEXT_PUBLIC_VOICE_AGENT_URL` as environment variables in the Vercel dashboard.
5. Deploy.

### Docker / Self-Hosted

```bash
npm run build
npm run start
```

Ensure `MONGODB_URI` and `NEXT_PUBLIC_VOICE_AGENT_URL` are set in the runtime environment.

<br>

##  License

This project is part of the [Zomato Live Agent](../) monorepo. See the root [LICENSE](../LICENSE) for details.
