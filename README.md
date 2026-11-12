# MindMate AI — Your Mind Matters. We're Here to Listen.

An everyday wellness companion: supportive AI chat, breathing exercises, mood tracking, mindfulness and a personal dashboard.
**Not a therapist, not a medical service, not an emergency service. It never diagnoses or recommends medication.**


## Features

- **AI Wellness Chat:** Talk with an AI companion for supportive conversations.
- **Breathing Exercises:** Practice guided breathing to relax and manage stress.
- **Mood Tracking:** Track your daily moods and emotional patterns.
- **Journal:** Write down thoughts, feelings, and personal reflections.
- **Mindfulness:** Explore activities that encourage emotional well-being.
- **Personal Dashboard:** Access your wellness activities in one place.
- **User Authentication:** Secure sign-up and login.

- ## Architecture

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


## Tech Stack

| Component | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | Python, FastAPI |
| AI Integration | Groq API |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| Frontend Hosting | Vercel |
| Backend Hosting | Render |

## Project Structure

- `frontend/` – Website interface and frontend functionality.
- `backend/` – API and AI integration.
- `database/` – Database schema and configuration.

## Deployment

- Frontend hosted on Vercel.
- Backend hosted on Render.
- Supabase manages authentication and database services.
- Groq API powers AI conversations.

## Security & Privacy

- API secrets are stored in backend environment variables.
- Supabase authentication protects user accounts.
- Database access is protected using Row Level Security (RLS).
- AI-generated responses are intended for general wellness support.

## Important Disclaimer

MindMate AI is a wellness companion, not a substitute for professional mental healthcare, medical advice, diagnosis, or emergency services.

If you are experiencing a mental health emergency, contact local emergency services or a qualified professional.

## Project Status

MindMate AI is an ongoing project. New features, improvements, and updates may be added over time.

---

**MindMate AI – Your Mind Matters. We're Here to Listen.**
