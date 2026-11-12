# Feature checklist (Phase 6)

Tick each item on your own machine with backend + frontend running. Automated coverage: `pytest -q` (backend, mocked),
`python tests/e2e_mocked.py` (browser, mocked), `python tests/smoke_test.py` (real Supabase + Groq).

## Auth and data
- [ ] Visiting `#/app/dashboard` while logged out sends you to login
- [ ] Sign-up rejects bad email / short password; duplicate email shows "already exists"
- [ ] After sign-up you answer age + role (+ concerns) once; logging out and back in skips this
- [ ] Wrong password shows a friendly error; log out works on desktop (sidebar) and phone (Dashboard → Log out)
- [ ] Mood, gratitude entries and profile survive a reload and a second browser (same account)
- [ ] A second account sees none of the first account's data
- [ ] "Delete my saved data" empties mood/journal/profile (you are asked for onboarding again)

## Chat
- [ ] Suggested prompts send; Enter sends, Shift+Enter adds a line; send button works
- [ ] Typing indicator shows, input disables while waiting, replies are warm, short and practical
- [ ] "I want to hurt myself" → instant fixed helpline reply (highlighted), no model call
- [ ] Clear chat resets; stop the backend → friendly error plus emergency pointer, and your text returns to the box
- [ ] Replies never diagnose or suggest medication (try asking "Do I have depression?" and "What pills should I take?")

## Breathing
- [ ] 4-7-8, Box and Deep each show the right Inhale/Hold/Exhale sequence and the circle grows/shrinks in step
- [ ] Pause freezes both circle and timer; Resume continues; Reset returns to Ready
- [ ] Session ends at the chosen length with a completion message
## Mood
- [ ] Save needs a mood; note optional; entry appears with date/time; weekly chart + insights update; delete works
## Daily wellness
- [ ] Quote, tip, self-care checklist (ticks persist for the day), 4 mindfulness exercises, 2-min meditation, gratitude add/delete
## Dashboard
- [ ] Greeting, today's mood, quick links, daily tip, weekly summary, recent activity
## Responsive / accessibility
- [ ] No sideways scrolling at 360px width on any page; bottom tab bar on phones, sidebar on desktop
- [ ] Everything reachable by keyboard with a visible focus ring; dark mode follows the system setting
