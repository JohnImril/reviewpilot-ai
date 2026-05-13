# ReviewPilot AI

Small Next.js app for checking pasted git diffs and returning a structured review.

The current implementation uses a local mock provider, so it works without API keys.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Scripts

```bash
npm run lint
npm run format
npm run format:check
npm run build
```

## Structure

- `app/page.tsx` - main UI
- `app/api/review/route.ts` - review endpoint
- `lib/schemas/review.ts` - request and response schemas
- `lib/ai/mockReview.ts` - local review logic
- `data/exampleDiffs.ts` - sample diffs for the UI

## API

`POST /api/review`

```json
{
  "diff": "diff --git a/app/page.tsx b/app/page.tsx\n..."
}
```
