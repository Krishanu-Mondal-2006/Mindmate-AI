# MindMate AI — Your Mind Matters. We're Here to Listen.

An everyday wellness companion: supportive AI chat, breathing exercises, mood tracking, mindfulness and a personal dashboard.
**Not a therapist, not a medical service, not an emergency service. It never diagnoses or recommends medication.**

## Architecture

```
Browser (Vercel, static HTML/CSS/JS)            FastAPI (Render)                 Groq API
  supabase-js: sign up / log in  ──┐            POST /api/chat  ───────────────▶ LLM
  Bearer <Supabase access token> ──┼──────────▶ /api/mood /api/journal /api/profile
                                   │                 │ verifies token with Supabase Auth,
                                   ▼                 ▼ then queries the DB AS the user
                              Supabase Auth ◀───── Supabase PostgreSQL (Row Level Security)
```
- Secrets (`GROQ_API_KEY`) exist only in backend env vars. The browser holds only the public Supabase URL and anon key.
- Passwords are hashed by Supabase Auth. The app never sees them.
- Every protected route verifies the user's token; the database is queried with that token, so RLS enforces "you only see your own rows".
- `safety.py` runs a deterministic crisis filter BEFORE any model call and returns a fixed response with helplines.

## Project layout
```
frontend/  index.html, css/style.css, js/{app,auth,api,chatbot,breathing,mood-tracker,wellness,util,config}.js, vercel.json
backend/   main.py, safety.py, requirements.txt, .env.example, tests/test_api.py
database/  schema.sql
```

## Setup (local)

### 1. Supabase (database + auth)
1. Create a project at supabase.com (free tier is fine).
2. **SQL Editor → New query →** paste all of `database/schema.sql` → **Run**. You should see "Success". Check **Table Editor** shows `profiles`, `mood_entries`, `journal_entries`.
3. **Project Settings → API:** copy the **Project URL** and the **anon / publishable** key. Do NOT use the `service_role` key anywhere.
4. **Authentication → Providers → Email:** for easy testing turn **off** "Confirm email". If you leave it on, new users must click the email link before logging in (the app handles both).
5. **Authentication → URL Configuration:** set Site URL to `http://localhost:5500` for now (later: your Vercel URL).

### 2. Groq (AI)
Create an API key at console.groq.com. The default model is `openai/gpt-oss-120b` because Groq retired `llama-3.3-70b-versatile` on 2026-08-16. Model IDs change, so check console.groq.com/docs/models and set `GROQ_MODEL` if needed.

### 3. Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                    # then fill in GROQ_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY
uvicorn main:app --reload --port 8000
```
Open http://localhost:8000/health. You should see `"groq_configured": true, "supabase_configured": true`. API docs: http://localhost:8000/docs.

Run the backend tests (no keys needed): `pytest -q`

### 4. Frontend
Edit `frontend/js/config.js`: set `SUPABASE_URL` and `SUPABASE_ANON_KEY` (leave `API_BASE_URL` as `http://localhost:8000`).
```bash
cd frontend && python -m http.server 5500
```
Open http://localhost:5500, create an account, finish onboarding, and try each feature.

## Testing
| Test | What it covers | Command |
|---|---|---|
| `backend/tests/test_api.py` | auth, chat, crisis filter, validation, mood CRUD (Supabase/Groq mocked) | `cd backend && pytest -q` |
| `tests/e2e_mocked.py` | every frontend feature in a real browser (APIs faked) | `pip install playwright && playwright install chromium`, serve `frontend` on :5500, `python tests/e2e_mocked.py` |
| `tests/smoke_test.py` | your REAL backend + Supabase + Groq, CORS, row isolation | see the docstring in the file |
| `docs/FEATURE_CHECKLIST.md` | manual checklist for everything else | |

## API
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | /health | no | status + config check |
| POST | /api/chat | yes | `{messages:[{role,content}], profile?}` → `{reply, crisis}` |
| GET/PUT | /api/profile | yes | onboarding answers |
| POST/GET | /api/mood | yes | `{mood, note?}` / recent entries |
| DELETE | /api/mood/{id} | yes | delete one entry |
| POST/GET | /api/journal | yes | `{kind: gratitude\|journal, content}` / `?kind=` |
| DELETE | /api/journal/{id} | yes | delete one entry |
| DELETE | /api/data | yes | delete all of the caller's saved rows |

## Troubleshooting
- **"Sign-in isn't configured"**: fill in `frontend/js/config.js`.
- **Chat says "can't reach the server"**: backend not running, wrong `API_BASE_URL`, or the page origin isn't listed in `ALLOWED_ORIGINS` (no trailing slash). On a phone, `localhost` means the phone itself, so use your deployed backend URL.
- **First request after idle is slow** on free hosting (Render sleeps). The app shows loading states and retries are safe.
- **502 from chat**: check the backend logs. Usually a wrong `GROQ_MODEL` or invalid `GROQ_API_KEY`.

## Known limits
- Crisis detection is regex-based and English-only; it can miss indirect phrasing. Verify the helpline numbers for your audience (`safety.py`).
- "Recent activity" and the self-care checklist are stored on the device only.
- "Delete my saved data" removes database rows; deleting the login itself needs a Supabase admin action (it needs the service_role key, which this app deliberately never holds).
- Chat messages are sent to Groq to generate replies and are not stored by this app. Don't promise users more privacy than that.

## Roadmap
Phase 7: security review · Phase 8: Vercel + Render deployment guide.
