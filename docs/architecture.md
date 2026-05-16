# Architecture

ReviewPilot AI keeps the UI, API contract, and review logic separated:

1. `app/page.tsx` collects a git diff and review mode.
2. `app/api/review/route.ts` validates the request and response with Zod.
3. `lib/ai/mockReview.ts` runs local deterministic heuristics.

The provider boundary is `lib/ai/reviewProvider.ts`, so a future LLM-backed provider can replace the mock implementation without changing the UI contract.
