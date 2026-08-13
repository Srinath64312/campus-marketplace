# Campus Marketplace

A student-to-student marketplace for the stuff that circulates around a campus every semester:
books, calculators, cycles, lab coats, notes, hostel furniture. Post it, swap it, or give it away.

**Stack:** FastAPI + SQLModel + SQLite · React 19 + TypeScript + Vite + Tailwind

## What makes it different

| | |
|---|---|
| **Barter swap rings** | Nobody ever has exactly what you want, so the backend builds a directed graph of who-wants-what and searches for closed loops. You give your guitar to Diya, get a cycle from Kabir, who gets a laptop from you — three-way and four-way trades no human would have spotted. |
| **Explainable price coach** | Every suggestion comes with its reasoning: comparable campus listings, category baseline, condition depreciation, item age, keyword signals, a confidence score and a fair range. No black box, no external API. |
| **Deal scoring on every card** | Listings are labelled *Steal / Good deal / Fair / Above market* against the campus median for that category and condition, with the delta and the number of comparables behind it. |
| **Leaving-campus auto-markdown** | Set a total discount and a deadline; the price slides down on its own so you are not haggling during finals week. Buyers see the countdown. |
| **Want-ads that hunt for you** | Save a search and the moment a matching item is posted, an alert fans out to you. Saved items also ping you on price drops. |
| **Trust scores with visible signals** | Ratings, completed deals, verified campus email, account age and recent activity — each contributing signal is shown, not just a number. |
| **Typo-tolerant, synonym-aware search** | Trigram fuzzy matching plus a campus synonym table with BM25-style ranking: `calulator` finds calculators, `cycle` finds bicycles. |
| **Safe hand-off spots** | Curated, public, well-lit meetup points plotted on a schematic campus map, with radius filtering so you only see items you can actually walk to. |
| **Live chat** | Per-listing buyer/seller threads over REST with a WebSocket hub for instant delivery. |
| **Community moderation** | Three independent reports auto-hide a listing pending review. |
| **Campus pulse** | Live stats: what is trending, median price, giveaways, 14-day posting activity, open swap rings. |

Plus the basics: auth, profiles, listing CRUD, image upload, category/condition/price/mode filters,
price sorting, wishlist, reviews, responsive layout.

## Run it

```bash
# backend  → http://localhost:8000  (docs at /docs)
cd backend
poetry install
poetry run uvicorn app.main:app --reload

# frontend → http://localhost:5173
cd frontend
npm install
npm run dev
```

The backend seeds six students and ~30 listings (including pre-built swap rings) on first start.
Demo login: `aarav@campus.ac.in` / `campus123`.

## Checks

```bash
cd backend  && poetry run ruff check . && poetry run ruff format --check . && poetry run pytest -q
cd frontend && npm run build && npm run lint
```

## Deploy

`render.yaml` at the repo root describes both services (FastAPI API on a persistent disk, static
React build). On Render: **New → Blueprint → pick this repo → Apply**. `JWT_SECRET` is generated
automatically. After the API service is live, copy its URL into the web service's `VITE_API_BASE`
and redeploy the frontend if Render suffixed the service name.

Any other host works too: the backend is a plain ASGI app
(`uvicorn app.main:app --host 0.0.0.0 --port $PORT`, deps in `backend/requirements.txt`) and the
frontend is a static `npm run build` bundle.

## Configuration

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./campus_marketplace.db` | |
| `JWT_SECRET` | dev placeholder | **must** be set to a real secret before deploying |
| `CORS_ORIGINS` | `*` | comma-separated in production |
| `SEED_ON_STARTUP` | `true` | set `false` for real data |
| `VITE_API_BASE` | `http://localhost:8000` | frontend build-time API base |
