# Getting started

[Back to the README](../README.md)

## Run locally

Use [Node.js 24 LTS](https://nodejs.org/en/about/previous-releases), npm, and Git.
Install the versions recorded in the lockfile:

```bash
git clone https://github.com/JohnImril/reviewpilot-ai.git
cd reviewpilot-ai
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). If that port is occupied, use the
address printed by Next.js. Click **Load Example Diff**, then **Analyze Diff**.
You should see a summary, risk factors, changed files, findings, and test ideas.

A fresh clone uses mock mode without any environment file. Review processing
runs in the local Next.js server; it is not a browser-only app. Mock analysis
does not send the diff to an external model.

To configure a provider or GitHub App, copy the example file first:

**macOS / Linux / Git Bash**

```bash
cp .env.example .env.local
```

**PowerShell**

```powershell
Copy-Item .env.example .env.local
```

Edit `.env.local`, then restart `npm run dev`. Keep credentials out of source
control and do not prefix server secrets with `NEXT_PUBLIC_`.

## Prepare a diff

Run `git diff` for unstaged tracked changes, `git diff --cached` for staged
changes, or `git diff main...HEAD` for changes relative to a branch. Replace
`main` with your repository's base branch. New untracked files appear only
after staging. Paste the unified diff, including `diff --git`, file headers,
and `@@` hunk headers, rather than a whole source file or a PR URL.

The UI supports General, React, TypeScript, and Frontend Performance modes.
The GitHub App currently always uses General mode.

## Use OpenAI

Set these values in `.env.local`:

```dotenv
AI_PROVIDER=openai
OPENAI_API_KEY=your_api_key
OPENAI_MODEL=your_model_id
```

Replace `your_api_key` and `your_model_id` before starting the server. The model
must be available to your API account and accept Chat Completions requests with
`response_format: { "type": "json_object" }`. The code defaults to
`gpt-5.4-mini` if `OPENAI_MODEL` is empty; that default does not guarantee access
for your account.

Restart the server and submit a small diff. The provider sends the raw diff,
parsed metadata, and review instructions to
`https://api.openai.com/v1/chat/completions`. API usage
may incur charges. Model responses must parse as JSON and pass the review schema.

Missing keys, API failures, and invalid output return errors. There is no
automatic fallback after an OpenAI request fails. An unset or unrecognized
`AI_PROVIDER` selects mock mode instead. Set `AI_PROVIDER=mock` and restart to
return to deterministic reviews.

The `/examples` page always uses `MockAIProvider`, even on an OpenAI-configured
deployment. It is a collection of repeatable examples, not a provider health check.

The dashboard's **Mock AI provider active** label is currently static and does
not reflect server configuration. Provider selection is controlled by the
server environment, not this label.

## Configuration reference

`.env.example` contains the main application settings. Optional delivery-store
and evaluation settings are listed below as well.

| Variable                     | Default        | Purpose                                                                      |
| ---------------------------- | -------------- | ---------------------------------------------------------------------------- |
| `AI_PROVIDER`                | `mock`         | `mock` or `openai`; unrecognized values select mock                          |
| `OPENAI_API_KEY`             | Unset          | Required for OpenAI reviews; server-side only                                |
| `OPENAI_MODEL`               | `gpt-5.4-mini` | Model sent to the OpenAI endpoint                                            |
| `GITHUB_APP_ID`              | Unset          | Numeric App ID for webhook reviews                                           |
| `GITHUB_APP_PRIVATE_KEY`     | Unset          | App PEM key; literal `\n` line breaks are accepted                           |
| `GITHUB_WEBHOOK_SECRET`      | Unset          | Secret used to verify webhook signatures                                     |
| `GITHUB_MAX_DIFF_CHARS`      | `100000`       | Maximum GitHub PR diff length; invalid values use the default                |
| `GITHUB_DELIVERY_STORE_PATH` | Unset          | Optional file store for a single long-lived Node instance; ignored on Vercel |
| `RUN_REAL_PROVIDER_EVALS`    | Unset          | Set to `1` with an API key to enable paid, networked evals                   |

The file delivery store is best-effort and is not transactional under concurrent
access. Serverless or multi-instance deployments require an external atomic
store. See [GitHub App setup](./github-app-setup.md) for integration details and
[the eval guide](../evals/README.md) for shell environment requirements.

## Build and run

```bash
npm run build
npm run start
```

Configure production environment variables in your host before running the app.
The GitHub App needs a publicly reachable HTTPS webhook URL and a Node.js runtime.
There is no built-in authentication or rate limiting for `POST /api/review`;
add access controls and usage limits before exposing a paid provider publicly.

## Troubleshooting

| Symptom                           | What to check                                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| npm reports an unsupported engine | Use Node.js 24 LTS, reopen the terminal, check `node --version`, then run `npm ci`.                                                              |
| `git diff` is empty               | Try `git diff --cached` for staged changes or compare your branch against its base.                                                              |
| No changed files appear           | Paste a unified diff with file and hunk headers; try a bundled example first.                                                                    |
| The dashboard still says mock     | The label is static. Check `AI_PROVIDER=openai` in the project root's `.env.local` and restart. A shell variable can override file settings.     |
| OpenAI key or model error         | Check the server-side key and model access. `/examples` works independently and cannot confirm these credentials.                                |
| Invalid JSON or schema error      | The provider output was rejected. Check model compatibility; retry with a smaller diff or use mock mode to verify the UI.                        |
| Manual API returns HTTP 400       | It currently uses 400 for both input and provider failures. Inspect the `error` field; the diff must be nonempty and at most 120,000 characters. |
| GitHub reports a failed delivery  | Follow the [installation and testing steps](./github-app-setup.md#4-install-and-test); verify permissions, secrets, and host timeouts.           |

If the problem persists, [report it](https://github.com/JohnImril/reviewpilot-ai/issues/new/choose)
with the provider, runtime version, reproduction steps, and sanitized error text.
