# AI usage overview

How AI tools were used to build TimeTracker42. The project story is in [the case study](../case-study.md); the
product is described in the [README](../../README.md).

**My role.** I set the scope and priorities, approved every plan before it was implemented, reviewed the changes,
tested against the real system, and merged every pull request myself. AI proposed, implemented bounded changes
and checked results. Nothing reached production without my go-ahead.

## AI Tools

| Tool | Used for |
|---|---|
| **Claude Code** (Anthropic; `claude-sonnet-5-5` in the October 2026 work) | Implementation, refactoring, tests, debugging, reading CI and production logs, documentation. Commits made with it carry a `Co-Authored-By` trailer |
| **Codex** (OpenAI, in VS Code; `gpt-5.3-codex` and `gpt-5.4`) | The early prototype and the Supabase rewrite (January to June 2026): planning, debugging, implementation, and security and release reviews |
| **ChatGPT** (OpenAI) | The original idea, an independent review of the repository, and keeping a map of its functions so that I understand the flow |

**Agents, tools and skills.** Claude Code worked as a bounded implementer and debugger. Codex worked as a planner,
implementer and reviewer. Claude Code used a shell (`git`, `gh`, `npm`, the Supabase CLI), file editing and a plan
mode that I approved before any implementation. It also used two MCP servers: the **Supabase MCP**, read-only, for
function logs, security advisors, the migration list and metadata queries (grants, policies, constraints), and
the built-in **browser** MCP to check the demo, previews and responsive layouts in a real browser. I did not
configure custom skills or sub-agents.

CI, CodeQL and Dependabot are automation, not AI, but they supplied the checks I relied on.

## Development Approach with AI

**Workflow.**
1. Describe the problem, or paste an outside review, and ask for a plan before any change.
2. The AI reads the code, logs and production state read-only, then lists the decisions it needs from me.
3. I answer and approve. Each change goes on its own branch and pull request.
4. CI runs, and I check the behaviour myself, including real 42 sign-ins.
5. I merge. Anything that touches production (migrations, secrets, flags) waits for my explicit go-ahead.

I deliberately use two different AI providers: this gives an outside observer's view of the same code and makes
use of the different strengths of each model. Security was a concern from the start, because the app handles student data
from 42.

### Key prompts

Spelling and grammar lightly corrected; the wording is otherwise as I wrote it.

- Diagnosis: "I am working on TimeTracker42. It currently is not running as I expected. It's deployed with
  Supabase and Cloudflare Workers, but the 42 OAuth fails. I suspect that the secret from 42 is old ..."
- Plan before code: "Help me plan out these changes, and then once I review, we will implement."
- Second opinion: "Here is ChatGPT's analysis of the platform. Help me decide what to implement and plan
  accordingly."
- Advice without changes: "What do you think? What suggestions would you make? DO NOT CHANGE ANYTHING YET."
- Strict review (Codex): "Re-audit the 9 previously fixed release-blocking issues only ... Be strict. Do not
  assume a fix is correct just because code changed."

### Key review points and decisions

| Review point | Decision | Verified by |
|---|---|---|
| Sign-in still failed after the stale 42 secret was rotated. The one-time exchange code was posted three times | Share one in-flight exchange per callback URL | Production logs: one callback and one `auth-exchange` 200 (before: 200, 400, 400); unit test |
| An outside review (ChatGPT) listed six findings | I had each one checked against the code and, for database claims, production. All six reproduced. I chose security, trustworthy sync and the planner, and deferred scheduled sync, offline history and CSV export | pgTAP tests that try the attacks the review described |
| Users could update their own profile row, including the 42 id that login trusts | Remove the policy and lock the identity mapping at the grant level, not only with RLS | `supabase/tests/database/security.test.sql` |
| A replayed callback URL could sign a victim into another account | Bind each login to the browser that started it. The verifier stays in `localStorage` with a 15-minute expiry | Deno tests and pgTAP; live endpoint checks (400, 400, 302) |
| Two overlapping sessions counted twice, and vanished days never cleared | Compute presence from merged intervals, reconcile only after a complete fetch, write results in one database function | `supabase/functions/_shared/attendance.ts` tests and `sync.test.sql` |
| Demo mode needs data without a backend | Sit at the data-access layer so the real calculations run over synthetic data of a fictional student. Edits reset on reload, which keeps it simple and keeps student data away from outside visitors | Unit tests and the end-to-end suite with no backend configured |
| Design direction | Claude Code recommended keeping magenta. I chose teal, which is closer to the 42 colours | A contrast test over every text and background pair |
| Three stacked pull requests did not all reach `main` | Verify on `main`, not on "merged". One landing pull request, and no more stacking | File-by-file check against `main` |
| Cloudflare builds failed on a stale Node version pin | Delete the pin, as recommended | The build passed on the pull request and on `main` |

**How I review.** I read as much as I can. I start from the last file I reviewed and move on to the new files,
linking back to update my mental model of how the pieces connect. I also asked ChatGPT to read my repository and
update a map of its functions, which I do for all my projects so that I understand the flow.

**Responsible use.** The demo, screenshots and tests use synthetic data for a fictional student. In the October
work I entered the rotated 42 secret myself in the Supabase dashboard rather than in chat. The AI's database
queries on production were read-only (grants, policies, constraints), alongside advisors and function logs. The
few production changes it made, one function deploy and one configuration flag, happened only after my explicit
go-ahead and were checked afterwards.

## Reflection

**What worked.** Reading code, logs and production state together found the second sign-in bug that a rotated
secret had hidden. A second provider's review, checked against the real system, set a sensible scope. Tests that
try to break things (cross-user access, identity edits, midnight splits) and CI on every pull request caught more
than I would have by eye.

**What failed.**
- A swallowed error cost time: every failure in the OAuth callback ended in an empty `catch`, so the logs could
  not tell a stale secret from anything else.
- A fixed secret hid a second bug: rotating it was necessary, but not enough.
- Several tests the AI wrote were wrong while the code was right. Reading the failure before changing code
  mattered.
- Stacked pull requests, a stale Node pin and a `supabase-js` type alias that drifted each failed in a way that
  only the real pipeline revealed.
- The AI could not see my Cloudflare dashboard or perform a real 42 sign-in, so that evidence had to come from me.

**What I changed, and why.**
- Structured logging in every Edge Function and a runbook that maps each browser error to its log event, so the
  next failure is diagnosable.
- One change per branch, no stacking, and checking `main` after every merge.
- Grants, not only row-level security, as the boundary for anything a user must not write.

In my own words: this project made me realise that development is much more complicated than I imagined.
Before it, I was mostly coding at 42 and had not really touched deployment, so I learned a lot on that front.
It also made me realise how important early architecture decisions are and how they affect deployment later.
It taught me about continuous integration, testing, hosting and databases. Everything was a first, but it was
very interesting to learn, and it informed my later decision to rebuild the project into what it is now. Every
phase was crucial to building the final app.
