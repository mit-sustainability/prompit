# Unit Test Scope (Prompit)

## Goals
- Catch prompt-processing regressions early.
- Keep tests fast and deterministic.
- Start with pure logic and minimal mocking.

## Phase 1 (high value, low setup)
1. `lib/prompt-utils.ts`
- `extractVariables`
- `sortPrompts`

Cases:
- Extract variables with whitespace: `{{ name }}` -> `name`
- Deduplicate repeated variables
- Ignore malformed tokens
- Sort by `noise` descending
- Sort by `echoed` descending
- Sort by `newest` descending (by `created_at`)

2. `lib/env.ts`
- `requiredEnv` throws when missing
- `authMode` defaults to `google`
- `authMode=email` when env is set

## Phase 2 (component behavior)
1. `app/components/PromptHub.tsx`
- Theme mode switching writes `localStorage`
- `system` mode responds to `matchMedia` changes
- Footer renders support email and current year

Notes:
- Use React Testing Library + jsdom.
- Mock Supabase client and auth calls.

## Phase 3 (auth and callback routes)
1. `app/auth/callback/route.ts`
- Redirects to `/`
- Exchanges code for session when code exists
- Skips exchange when code is missing

2. `lib/supabase/server.ts`
- Wires cookie get/set bridge correctly (mock `cookies()`)

## Recommended pass criteria
- Phase 1 required before PR merge.
- Phase 2 required before UI refactors.
- Phase 3 required before auth changes.

## Suggested file layout
- `lib/__tests__/prompt-utils.test.ts`
- `lib/__tests__/env.test.ts`
- `app/components/__tests__/PromptHub.test.tsx`
- `app/auth/callback/__tests__/route.test.ts`
