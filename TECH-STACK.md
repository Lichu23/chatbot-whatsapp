# Tech Stack & Claude Code Skills

## Tech Stack

### Runtime & Server
| Tech | Role | Why |
|---|---|---|
| **Node.js 18+** | Runtime | Async-first, perfect for webhook + AI call patterns |
| **Express.js** | HTTP server | Lightweight, handles Twilio webhooks natively |

### Database
| Tech | Role | Why |
|---|---|---|
| **Supabase** (PostgreSQL) | Database + auth | Free tier, real-time subscriptions (useful for future client chat), row-level security ready for multi-tenant |

### Messaging
| Tech | Role | Why |
|---|---|---|
| **Twilio WhatsApp API** | Inbound/outbound messaging | Production-ready, handles webhooks, message templates for future notifications |

### AI (Local)
| Tech | Role | Why |
|---|---|---|
| **Ollama** | Local LLM inference | Free, private, no API costs. Runs llama3/mistral locally |
| **HTTP fetch** | Ollama client | Ollama exposes a REST API — no SDK needed |

### Dev Tools
| Tech | Role | Why |
|---|---|---|
| **dotenv** | Environment config | Standard .env management |
| **ngrok** | Local tunnel | Expose localhost for Twilio webhooks during dev |
| **nodemon** or `--watch` | Auto-reload | Node 18+ has `--watch` built in |

### NOT using (and why)
| Skipped | Why |
|---|---|
| TypeScript | MVP speed — can migrate later. Plain JS reduces setup friction |
| ORM (Prisma/Knex) | Supabase JS client is enough for our queries. No complex joins |
| Redis | No need for caching in MVP — Supabase handles state |
| Docker | Overkill for MVP. Deploy directly or add later |
| Frontend | No frontend — everything happens in WhatsApp |

---

## Claude Code Skills

Install with: `npx skills add <owner/repo> <skill-name>`

### Core (install all of these)

| # | Skill | Install | Why |
|---|---|---|---|
| 1 | **supabase-postgres-best-practices** | `npx skills add supabase/agent-skills` | Our entire database layer — table design, RLS policies, edge functions, real-time. Critical for getting the schema and queries right |
| 2 | **nodejs-backend-patterns** | `npx skills add wshobson/agents nodejs-backend-patterns` | Express middleware, error handling, project structure, async patterns. Directly applies to our webhook server |
| 3 | **postgresql-table-design** | `npx skills add wshobson/agents postgresql-table-design` | Table design, indexes, constraints, normalization. Ensures our schema is solid |
| 4 | **api-design-principles** | `npx skills add wshobson/agents api-design-principles` | REST endpoint design, request/response patterns. Applies to our webhook route and future admin API |
| 5 | **error-handling-patterns** | `npx skills add wshobson/agents error-handling-patterns` | Consistent error handling across services. Critical for a bot that can't crash — Twilio won't retry gracefully |
| 6 | **test-driven-development** | `npx skills add obra/superpowers test-driven-development` | We should test the workflow logic, validators, and AI parsers. TDD keeps the bot reliable |

### Planning & Process (highly recommended)

| # | Skill | Install | Why |
|---|---|---|---|
| 7 | **writing-plans** | `npx skills add obra/superpowers writing-plans` | Helps Claude Code break the project into implementation tasks based on our plan |
| 8 | **executing-plans** | `npx skills add obra/superpowers executing-plans` | Follows the plan step by step without skipping or hallucinating features |
| 9 | **verification-before-completion** | `npx skills add obra/superpowers verification-before-completion` | Makes Claude Code verify each step works before moving on — prevents broken builds |
| 10 | **systematic-debugging** | `npx skills add obra/superpowers systematic-debugging` | When something breaks (and it will with AI parsing), this helps trace issues methodically |

### Nice to Have (install if needed later)

| # | Skill | Install | When |
|---|---|---|---|
| 11 | **architecture-patterns** | `npx skills add wshobson/agents architecture-patterns` | When adding multi-tenant or scaling the service layer |
| 12 | **docker-expert** | `npx skills add sickn33/antigravity-awesome-skills docker-expert` | When containerizing for deployment |
| 13 | **modern-javascript-patterns** | `npx skills add wshobson/agents modern-javascript-patterns` | If migrating to ES modules or modernizing patterns |
| 14 | **database-migration** | `npx skills add wshobson/agents database-migration` | When schema evolves and you need migration scripts |

---

## Quick Setup Script

```bash
# Install Claude Code skills (run once in your project root)
npx skills add supabase/agent-skills
npx skills add wshobson/agents nodejs-backend-patterns
npx skills add wshobson/agents postgresql-table-design
npx skills add wshobson/agents api-design-principles
npx skills add wshobson/agents error-handling-patterns
npx skills add obra/superpowers test-driven-development
npx skills add obra/superpowers writing-plans
npx skills add obra/superpowers executing-plans
npx skills add obra/superpowers verification-before-completion
npx skills add obra/superpowers systematic-debugging
```

---

## Project Dependencies

```bash
# Production
npm install express @supabase/supabase-js twilio dotenv uuid

# Development
npm install --save-dev nodemon
```

No AI SDK needed — Ollama is called via `fetch()` to `http://localhost:11434/api/chat`.

---

## Ollama Setup

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull model (pick one)
ollama pull llama3        # Best general-purpose (8B params)
ollama pull mistral       # Good alternative, slightly faster
ollama pull gemma2        # Google's model, good at structured output

# Verify it's running
curl http://localhost:11434/api/tags
```

**Recommended model for this project: `llama3`** — best balance of speed and accuracy for JSON extraction from Spanish text.
