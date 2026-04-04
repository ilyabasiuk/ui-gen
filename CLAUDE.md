# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (Turbopack, port 3000 or next available)
npm run build        # Production build
npm run lint         # ESLint
npm test             # Run Vitest test suite
npm run setup        # First-time setup: install deps + Prisma generate + migrate
npm run db:reset     # Reset SQLite database to fresh state
```

To run a single test file: `npx vitest src/lib/__tests__/file-system.test.ts`

## Architecture

UIGen is an AI-powered React component generator. Users describe components in a chat interface; Claude generates code into a **virtual file system** (in-memory, no disk writes), which is rendered live in an iframe preview.

### Key Data Flow

1. User sends message → `POST /api/chat` (streaming)
2. Claude responds using tool calls:
   - `str_replace_editor` (`src/lib/tools/str-replace.ts`) — create/edit files
   - `file_manager` (`src/lib/tools/file-manager.ts`) — delete/list files
3. Tools mutate the `VirtualFileSystem` instance
4. `FileSystemContext` propagates changes to the editor and preview
5. `PreviewFrame` transforms JSX via `src/lib/transform/jsx-transformer.ts` and renders in an iframe

### Core Abstractions

- **`VirtualFileSystem`** (`src/lib/file-system.ts`): In-memory file tree. Projects are persisted by serializing this to JSON in the `Project.data` DB column.
- **`ChatContext`** (`src/lib/contexts/chat-context.tsx`): Manages message history, project ID, and triggers API calls.
- **`FileSystemContext`** (`src/lib/contexts/file-system-context.tsx`): Global file system state shared between editor and preview.
- **Provider abstraction** (`src/lib/provider.ts`): Returns an Anthropic language model if `ANTHROPIC_API_KEY` is set, otherwise falls back to a `MockLanguageModel` for development without an API key.
- **System prompt** (`src/lib/prompts/generation.tsx`): Instructs Claude on how to generate components. Uses Anthropic prompt caching (`cache_control: { type: "ephemeral" }`).

### Auth & Persistence

- Session-based auth with JWT (`src/lib/auth.ts`, `jose` library), passwords hashed with bcrypt.
- Server Actions in `src/actions/` handle all auth and project mutations.
- SQLite via Prisma. Schema: `User` (email, password) → `Project` (name, messages JSON, data JSON).
- Anonymous users can generate without signing in; their work is not persisted.

### Routing

| Route | Purpose |
|-------|---------|
| `/` | Home — redirects authenticated users or shows login/signup |
| `/[projectId]` | Project editor (requires auth) |
| `/api/chat` | Streaming chat endpoint |

### Tech Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Prisma + SQLite · Vercel AI SDK (`ai`, `@ai-sdk/anthropic`) · Monaco Editor · Shadcn/ui (new-york style, neutral base) · Vitest + jsdom

### Environment

Only required env var: `ANTHROPIC_API_KEY` in `.env`. Without it the app uses a mock provider (no actual AI responses).

`NODE_OPTIONS='--require ./node-compat.cjs'` is prepended to all Next.js commands via the npm scripts — this is a Node.js compatibility shim required for the project to run correctly.
