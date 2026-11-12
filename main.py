"""MindMate AI backend (FastAPI).

Routes
  GET    /health
  POST   /api/chat            Groq-powered wellness chat (crisis filter runs first)
  GET    /api/profile   PUT /api/profile
  POST   /api/mood      GET /api/mood      DELETE /api/mood/{id}
  POST   /api/journal   GET /api/journal   DELETE /api/journal/{id}
  DELETE /api/data            delete the caller's saved rows

Auth: the browser signs in with Supabase and sends its access token as `Authorization: Bearer`.
The token is verified with Supabase Auth, and database calls are made AS that user, so
Row Level Security guarantees users only ever touch their own rows.
"""
import hashlib
import logging
import re
import time
from contextlib import asynccontextmanager
from typing import Literal, Optional
from uuid import UUID

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from safety import ALLOWED_AGES, ALLOWED_CONCERNS, ALLOWED_ROLES, CRISIS_REPLY, build_system_prompt, is_crisis

log = logging.getLogger("mindmate")
logging.basicConfig(level=logging.INFO)

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-120b"
    groq_reasoning_effort: str = ""
    supabase_url: str = ""
    supabase_anon_key: str = ""
    allowed_origins: str = "http://localhost:5500"


settings = Settings()

_http: Optional[httpx.AsyncClient] = None


def client() -> httpx.AsyncClient:
    global _http
    if _http is None:
        _http = httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0))
    return _http


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    global _http
    if _http is not None:
        await _http.aclose()
        _http = None


app = FastAPI(title="MindMate AI API", version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip().rstrip("/") for o in settings.allowed_origins.split(",") if o.strip()],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

# ---------------------------------------------------------------- auth + rate limit
class AuthedUser(BaseModel):
    id: str
    token: str


_auth_cache: dict[str, tuple[float, str]] = {}


async def current_user(authorization: Optional[str] = Header(default=None)) -> AuthedUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Please log in to continue.")
    token = authorization[7:].strip()
    if not token or len(token) > 4096:
        raise HTTPException(401, "Please log in to continue.")
    if not (settings.supabase_url and settings.supabase_anon_key):
        raise HTTPException(503, "The server is not configured for authentication.")
    key = hashlib.sha256(token.encode()).hexdigest()
    hit = _auth_cache.get(key)
    if hit and hit[0] > time.time():
        return AuthedUser(id=hit[1], token=token)
    try:
        r = await client().get(
            f"{settings.supabase_url.rstrip('/')}/auth/v1/user",
            headers={"apikey": settings.supabase_anon_key, "Authorization": f"Bearer {token}"},
        )
    except httpx.HTTPError:
        raise HTTPException(502, "The authentication service is unreachable.")
    uid = r.json().get("id") if r.status_code == 200 else None
    if not uid:
        raise HTTPException(401, "Your session is invalid or has expired. Please log in again.")
    if len(_auth_cache) > 1000:
        _auth_cache.clear()
    _auth_cache[key] = (time.time() + 60, uid)
    return AuthedUser(id=uid, token=token)


_hits: dict[str, list[float]] = {}


def rate_limit(user_id: str, limit: int = 20, window: int = 60) -> None:
    now = time.time()
    recent = [t for t in _hits.get(user_id, []) if now - t < window]
    if len(recent) >= limit:
        raise HTTPException(429, "You're sending messages quickly. Please wait a moment.")
    recent.append(now)
    _hits[user_id] = recent


# ---------------------------------------------------------------- database (PostgREST as the user)
async def rest(method: str, table: str, user: AuthedUser, *, params=None, body=None, prefer: Optional[str] = None):
    headers = {"apikey": settings.supabase_anon_key, "Authorization": f"Bearer {user.token}", "Content-Type": "application/json"}
    if prefer:
        headers["Prefer"] = prefer
    try:
        r = await client().request(method, f"{settings.supabase_url.rstrip('/')}/rest/v1/{table}", params=params, json=body, headers=headers)
    except httpx.HTTPError:
        raise HTTPException(502, "The database is unreachable.")
    if r.status_code in (401, 403):
        raise HTTPException(401, "Your session has expired. Please log in again.")
    if r.status_code >= 500:
        log.error("supabase %s %s -> %s", method, table, r.status_code)
        raise HTTPException(502, "The database had a problem. Please try again.")
    if r.status_code >= 400:
        log.warning("supabase %s %s -> %s %s", method, table, r.status_code, r.text[:200])
        raise HTTPException(400, "That request was rejected.")
    return r.json() if r.content else None


# ---------------------------------------------------------------- models
class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=6000)  # assistant replies can be long; user messages are capped below

    @field_validator("content")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("empty message")
        return v


class ChatProfile(BaseModel):
    age_group: Optional[str] = Field(default=None, max_length=20)
    role: Optional[str] = Field(default=None, max_length=40)
    concerns: list[str] = Field(default_factory=list, max_length=10)
    mood_today: Optional[str] = Field(default=None, max_length=20)


class ChatIn(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=20)
    profile: ChatProfile = Field(default_factory=ChatProfile)

    @field_validator("messages")
    @classmethod
    def _user_len(cls, v):
        if any(m.role == "user" and len(m.content) > 2000 for m in v):
            raise ValueError("message too long")
        return v


class ChatOut(BaseModel):
    reply: str
    crisis: bool = False


MoodKey = Literal["very_happy", "happy", "neutral", "sad", "stressed"]


class MoodIn(BaseModel):
    mood: MoodKey
    note: str = Field(default="", max_length=1000)


class JournalIn(BaseModel):
    kind: Literal["gratitude", "journal"] = "journal"
    content: str = Field(min_length=1, max_length=2000)

    @field_validator("content")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("empty entry")
        return v


class ProfileIn(BaseModel):
    age_group: str
    role: str
    concerns: list[str] = Field(default_factory=list, max_length=10)
    display_name: Optional[str] = Field(default=None, max_length=40)

    @field_validator("age_group")
    @classmethod
    def _age(cls, v):
        if v not in ALLOWED_AGES:
            raise ValueError("invalid age group")
        return v

    @field_validator("role")
    @classmethod
    def _role(cls, v):
        if v not in ALLOWED_ROLES:
            raise ValueError("invalid role")
        return v

    @field_validator("concerns")
    @classmethod
    def _concerns(cls, v):
        if any(c not in ALLOWED_CONCERNS for c in v):
            raise ValueError("invalid concern")
        return list(dict.fromkeys(v))


# ---------------------------------------------------------------- routes
@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "mindmate-ai",
        "version": app.version,
        "groq_configured": bool(settings.groq_api_key),
        "supabase_configured": bool(settings.supabase_url and settings.supabase_anon_key),
    }


@app.post("/api/chat", response_model=ChatOut)
async def chat(body: ChatIn, user: AuthedUser = Depends(current_user)):
    last = body.messages[-1]
    if last.role != "user":
        raise HTTPException(422, "The last message must be from the user.")
    if is_crisis(last.content):  # deterministic safety routing: no LLM, and never rate-limited
        return ChatOut(reply=CRISIS_REPLY, crisis=True)
    rate_limit(user.id)
    if not settings.groq_api_key:
        raise HTTPException(503, "Chat is not configured on the server.")

    p = body.profile
    messages = [{"role": "system", "content": build_system_prompt(p.age_group, p.role, p.concerns, p.mood_today)}]
    kept, budget = [], 12000  # keep the most recent turns that fit; the latest message is always kept
    for m in reversed(body.messages):
        if kept and budget - len(m.content) < 0:
            break
        kept.append({"role": m.role, "content": m.content}); budget -= len(m.content)
    messages += reversed(kept)
    payload = {"model": settings.groq_model, "messages": messages, "temperature": 0.7, "max_tokens": 1024}
    if settings.groq_reasoning_effort:
        payload["reasoning_effort"] = settings.groq_reasoning_effort
    try:
        r = await client().post(GROQ_URL, json=payload, headers={"Authorization": f"Bearer {settings.groq_api_key}"})
    except httpx.TimeoutException:
        raise HTTPException(504, "The AI took too long to respond. Please try again.")
    except httpx.HTTPError:
        raise HTTPException(502, "The AI service is unreachable.")
    if r.status_code == 429:
        raise HTTPException(429, "The AI service is busy. Please try again in a moment.")
    if r.status_code != 200:
        log.error("groq error %s: %s", r.status_code, r.text[:300])  # never log user messages
        raise HTTPException(502, "The AI service returned an error.")
    try:
        text = r.json()["choices"][0]["message"].get("content") or ""
    except (KeyError, IndexError, ValueError):
        text = ""
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip()
    if not text:
        raise HTTPException(502, "The AI returned an empty response. Please try again.")
    return ChatOut(reply=text)


@app.get("/api/profile")
async def get_profile(user: AuthedUser = Depends(current_user)):
    rows = await rest("GET", "profiles", user, params={"select": "display_name,age_group,role,concerns", "id": f"eq.{user.id}"})
    return rows[0] if rows else None


@app.put("/api/profile")
async def put_profile(body: ProfileIn, user: AuthedUser = Depends(current_user)):
    row = {"id": user.id, **body.model_dump()}
    rows = await rest("POST", "profiles", user, params={"on_conflict": "id"}, body=row, prefer="resolution=merge-duplicates,return=representation")
    return rows[0]


@app.post("/api/mood", status_code=201)
async def add_mood(body: MoodIn, user: AuthedUser = Depends(current_user)):
    rows = await rest("POST", "mood_entries", user, body={"user_id": user.id, "mood": body.mood, "note": body.note.strip() or None}, prefer="return=representation")
    return rows[0]


@app.get("/api/mood")
async def list_mood(limit: int = Query(100, ge=1, le=500), user: AuthedUser = Depends(current_user)):
    return await rest("GET", "mood_entries", user, params={"select": "id,mood,note,created_at", "user_id": f"eq.{user.id}", "order": "created_at.desc", "limit": limit})


@app.delete("/api/mood/{entry_id}")
async def delete_mood(entry_id: UUID, user: AuthedUser = Depends(current_user)):
    rows = await rest("DELETE", "mood_entries", user, params={"id": f"eq.{entry_id}", "user_id": f"eq.{user.id}"}, prefer="return=representation")
    if not rows:
        raise HTTPException(404, "Entry not found.")
    return {"deleted": True}


@app.post("/api/journal", status_code=201)
async def add_journal(body: JournalIn, user: AuthedUser = Depends(current_user)):
    rows = await rest("POST", "journal_entries", user, body={"user_id": user.id, "kind": body.kind, "content": body.content}, prefer="return=representation")
    return rows[0]


@app.get("/api/journal")
async def list_journal(kind: Optional[Literal["gratitude", "journal"]] = None, limit: int = Query(100, ge=1, le=500), user: AuthedUser = Depends(current_user)):
    params = {"select": "id,kind,content,created_at", "user_id": f"eq.{user.id}", "order": "created_at.desc", "limit": limit}
    if kind:
        params["kind"] = f"eq.{kind}"
    return await rest("GET", "journal_entries", user, params=params)


@app.delete("/api/journal/{entry_id}")
async def delete_journal(entry_id: UUID, user: AuthedUser = Depends(current_user)):
    rows = await rest("DELETE", "journal_entries", user, params={"id": f"eq.{entry_id}", "user_id": f"eq.{user.id}"}, prefer="return=representation")
    if not rows:
        raise HTTPException(404, "Entry not found.")
    return {"deleted": True}


@app.delete("/api/data")
async def delete_my_data(user: AuthedUser = Depends(current_user)):
    for table, col in (("mood_entries", "user_id"), ("journal_entries", "user_id"), ("profiles", "id")):
        await rest("DELETE", table, user, params={col: f"eq.{user.id}"})
    return {"deleted": True}
