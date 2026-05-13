# Architecture

The app keeps the review logic behind a small provider interface.

Request flow:

1. `app/page.tsx` posts a pasted diff to `/api/review`.
2. `app/api/review/route.ts` validates the request.
3. `MockReviewProvider` analyzes the diff locally.
4. The route validates the response and returns JSON.

Important files:

- `lib/schemas/review.ts` - shared Zod schemas and types
- `lib/ai/reviewProvider.ts` - provider interface
- `lib/ai/mockReview.ts` - current mock implementation
- `lib/ai/reviewPrompt.ts` - prompt template for a future model provider

Current limits:

- no auth
- no database
- no external AI call
- no GitHub/GitLab integration
