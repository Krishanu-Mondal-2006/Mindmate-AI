"""Safety layer: deterministic crisis detection, crisis response, and the chat system prompt.

The crisis filter runs BEFORE any LLM call, so acute-distress messages always get the same
vetted response with real helplines, regardless of what the model might say.
Limitations: keyword/regex based, English only, and it can miss indirect phrasing. It is a
safety net, not a clinical tool.
"""
import re

ALLOWED_AGES = ["13–17", "18–24", "25–34", "35–49", "50+"]
ALLOWED_ROLES = ["Student", "Job seeker", "Working professional", "Life transition"]
ALLOWED_CONCERNS = ["Exam stress", "Career anxiety", "Work burnout", "Loneliness", "Relationships", "Sleep", "General stress"]

_PATTERNS = [
    r"\b(kill|end|take)\s+(myself|my\s+own\s+life|my\s+life)\b",
    r"\bend(ing)?\s+it\s+all\b",
    r"\bsuicid(e|al)\b",
    r"\bwant(ed|ing)?\s+to\s+die\b",
    r"\bwish\s+i\s+(was|were)\s+dead\b",
    r"\bdon'?t\s+want\s+to\s+(live|be\s+alive|be\s+here|wake\s+up)\b",
    r"\bbetter\s+off\s+(dead|without\s+me)\b",
    r"\bno\s+(reason|point)\s+(to|in)\s+(live|living|go\s+on|going\s+on)\b",
    r"\b(hurt(ing)?|harm(ing)?|cut(ting)?|injur(e|ing)|punish(ing)?)\s+myself\b",
    r"\bself[\s-]?harm",
    r"\boverdos(e|ed|ing)\b",
    r"\bcan'?t\s+(go\s+on|take\s+it\s+anymore|do\s+this\s+anymore)\b",
    r"\b(going|want|plan(ning)?)\s+to\s+(kill|hurt|harm)\s+(him|her|them|someone|somebody|everyone|my\s+\w+)\b",
    r"\b(i\s+am|i'?m)\s+(being\s+)?(abused|beaten|in\s+danger)\b",
]
_CRISIS = [re.compile(p) for p in _PATTERNS]


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower().replace("’", "'").replace("‘", "'")).strip()


def is_crisis(text: str) -> bool:
    t = _norm(text)
    return any(p.search(t) for p in _CRISIS)


CRISIS_REPLY = (
    "I'm really glad you told me, and I'm so sorry you're carrying this. What you're feeling matters, "
    "and you deserve support from a real person right now.\n\n"
    "If you might act on these thoughts or you're in immediate danger, please call your local emergency "
    "number now (112 in India, 911 in the US) or go to the nearest emergency room.\n\n"
    "You can also reach a crisis line at any time:\n"
    "• India: Tele-MANAS 14416 (or 1-800-891-4416)\n"
    "• US: call or text 988\n"
    "• Elsewhere: findahelpline.com lists free lines by country\n\n"
    "If you can, tell someone near you, such as a friend, family member or neighbour, that you're not okay "
    "and ask them to stay with you. I'm an AI wellness companion, not a crisis service or a therapist, so I "
    "can't keep you safe myself, but I'm here to keep talking while you reach out."
)

_BASE_PROMPT = """You are MindMate, a warm, calm AI wellness companion inside a mental-wellness web app.

Role and limits:
- You offer everyday emotional support: listening, reflection, simple coping ideas and mindfulness techniques.
- You are NOT a therapist, doctor or emergency service. Never diagnose or label conditions, never suggest or comment on medication or dosages, and never claim to treat anything.
- If someone seems in danger, mentions self-harm or suicide, or describes abuse, respond with compassion and urge them to contact local emergency services or a crisis line right away.
- Do not promise confidentiality or privacy beyond what the app actually does. If asked, say you can't make guarantees and suggest they avoid sharing sensitive identifying details.
- Gently suggest talking to a trusted person or a qualified professional when problems are persistent or heavy.

Style:
- Acknowledge feelings first, without judgment, in plain, kind language. No clichés or toxic positivity.
- Usually 60-140 words. Plain text only: no markdown headings, no tables. Short lists only when steps help.
- Ask at most ONE gentle question, and only if it helps (for example what is worrying them most).
- Offer one small practical step or a brief grounding or breathing exercise when appropriate. You can mention the app's Breathe, Mood and Daily wellness pages.
- Tailor suggestions to the person's situation (below) when it is relevant, but never assume details they have not shared.
- If a request is unrelated to wellbeing, politely steer back or give a brief helpful answer, staying in your role."""


def build_system_prompt(age_group=None, role=None, concerns=None, mood_today=None) -> str:
    bits = []
    if age_group in ALLOWED_AGES:
        bits.append(f"age group {age_group}")
    if role in ALLOWED_ROLES:
        bits.append(f"describes themselves as: {role}")
    cs = [c for c in (concerns or []) if c in ALLOWED_CONCERNS]
    if cs:
        bits.append("topics they chose: " + ", ".join(cs))
    if mood_today in {"Very Happy", "Happy", "Neutral", "Sad", "Stressed"}:
        bits.append(f"mood logged today: {mood_today}")
    return _BASE_PROMPT + ("\n\nAbout this person (self-reported, may be incomplete): " + "; ".join(bits) + "." if bits else "")
