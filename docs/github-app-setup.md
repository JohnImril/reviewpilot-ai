# GitHub App MVP setup

This guide registers ReviewPilot AI as a private GitHub App for a test
repository. The integration is an MVP: it receives pull request webhooks,
downloads the unified diff, runs the existing review provider, and creates or
updates one top-level issue comment.

## 1. Create the GitHub App

1. In GitHub, open **Settings → Developer settings → GitHub Apps → New GitHub
   App**. For an organization-owned App, start in the organization's settings.
2. Choose a unique App name.
3. Set **Homepage URL** to the deployed ReviewPilot URL or the public repository
   URL. ReviewPilot does not currently need an OAuth callback URL, user
   authorization callback, device flow, or setup URL because it does not sign
   users in.
4. Set **Webhook URL** to the public HTTPS deployment followed by
   `/api/github/webhook`, for example
   `https://reviewpilot.example/api/github/webhook`. GitHub cannot reach
   `localhost`; use a secure tunnel only for local testing.
5. Generate a high-entropy webhook secret (for example with a password manager)
   and enter it in GitHub. Save the same value as `GITHUB_WEBHOOK_SECRET` in the
   deployment environment. Never commit it.
6. Keep **Active** enabled.

## 2. Set minimum permissions and events

Under **Repository permissions**, select:

| Permission    | Access         | Why                                                   |
| ------------- | -------------- | ----------------------------------------------------- |
| Pull requests | Read-only      | Read pull request metadata and its unified diff.      |
| Issues        | Read and write | List, create, and update top-level PR issue comments. |

No Contents permission is required. ReviewPilot does not clone repositories,
run PR code, change files, approve, merge, or use the Checks API. After changing
App permissions, an existing installation may require owner approval.

Under **Subscribe to events**, select **Pull request**. GitHub sends all actions
for that event; ReviewPilot processes only `opened`, `reopened`, and
`synchronize`, and acknowledges the rest without work. Save the App.

## 3. Get credentials

1. Copy the numeric **App ID** from the App settings page into `GITHUB_APP_ID`.
   Do not confuse it with Client ID.
2. In **Private keys**, choose **Generate a private key**. GitHub downloads a
   `.pem` file. Treat it as a secret and do not place it in this repository.
3. Put the PEM content in `GITHUB_APP_PRIVATE_KEY`. Multiline values are accepted.
   If the environment UI requires one line, replace real line breaks with
   literal `\n`; ReviewPilot converts them back before signing the App JWT.
4. Keep the webhook secret in `GITHUB_WEBHOOK_SECRET`.

Local `.env.local` example:

```env
AI_PROVIDER=mock
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
GITHUB_WEBHOOK_SECRET=replace-with-a-random-secret
GITHUB_MAX_DIFF_CHARS=100000
```

For Vercel, add the same variables in **Project Settings → Environment
Variables** for the intended environments, then redeploy. Keep
`AI_PROVIDER=mock` to run without an OpenAI key. Vercel values are secrets; do
not prefix them with `NEXT_PUBLIC_`.

## 4. Install and test

1. On the App settings page choose **Install App**.
2. Select your account or organization, choose **Only select repositories**, and
   select the test repository.
3. Confirm the installation. GitHub assigns an installation ID automatically;
   it arrives in each webhook payload and is not configured manually.
4. In **Advanced** on the App settings page, inspect recent webhook deliveries.
   Redeliver the `ping` event if necessary. A correctly signed ping returns HTTP
   200 with `{"status":"ok","event":"ping"}`.
5. Open a test pull request containing a small unified diff. The delivery should
   return `status: processed`, and the PR should receive a **ReviewPilot AI
   Report** comment.
6. Push another commit to the PR. The `pull_request.synchronize` delivery should
   update that same comment rather than creating a second ReviewPilot comment.
7. Check the safe configuration indicator at `GET /api/github/status`. It shows
   only whether all GitHub variables are present, never their values.

Fork pull requests are safe within this design: the App reads GitHub's diff and
posts text. It does not expose secrets to, clone, or execute code from the fork.

## 5. Local signed request helper

Before redelivering a production webhook, run a live dry-run with the same App
credentials (it does not mutate GitHub):

```bash
npm run github:smoke -- --repo JohnImril/reviewpilot-ai --pr <number>
```

To prove comment write access, add `--publish`. This creates, updates, and then
deletes a marker canary. If cleanup fails, the command prints its comment ID/URL.
It never prints credentials, tokens, the full diff, or comment bodies.

After deploying, open the GitHub App settings, choose **Advanced**, open the
failed `pull_request` delivery, and click **Redeliver**. Correlate its delivery
ID with Vercel Logs and inspect only `deliveryId`, event/action, repository, PR,
installation ID, processing stage/duration, GitHub method/path/status, request
ID, accepted permissions, safe message, validation fields, and operation.

Start Next.js with a local test secret:

```bash
GITHUB_WEBHOOK_SECRET=local-test-secret npm run dev
```

In another shell run:

```bash
npm run github:webhook:test
```

The helper reads the sanitized `pull_request.opened` fixture, signs the exact raw
UTF-8 body with `local-test-secret`, and posts it to localhost. Override
`GITHUB_TEST_WEBHOOK_SECRET` and `GITHUB_TEST_WEBHOOK_URL` if needed. The fixture
contains a placeholder installation ID, so signature and payload validation can
succeed while downstream authentication is expected to fail unless you replace
the fixture ID locally with an installation available to your App. Do not commit
that local change.

The `github-pull-request-synchronize.json` fixture is also available for tests.

## 6. Remove access

To revoke repository access, open GitHub **Settings → Applications → Installed
GitHub Apps**, select ReviewPilot, and uninstall it (or remove selected
repositories). To retire the App itself, return to **Developer settings → GitHub
Apps**, open the App, revoke/delete its private keys, and delete the App. Remove
the deployment environment variables and redeploy. Existing short-lived
installation tokens expire automatically; uninstalling also revokes the
installation's access.

## MVP limitations

- Review runs synchronously in the webhook request; there is no queue or
  background worker. It is intended for the mock or another fast provider;
  GitHub can treat a slow webhook response as failed.
- Duplicate delivery protection is in memory, bounded, and instance-local. It is
  best-effort on serverless deployments. Comment upsert remains the durable
  protection against duplicate ReviewPilot comments.
- Comment discovery reads up to 1,000 issue comments (10 pages of 100).
- Diffs over `GITHUB_MAX_DIFF_CHARS` (100,000 by default) are not partially
  reviewed; the App posts an explicit notice.
- The App publishes one top-level comment. It does not create inline annotations,
  Check Runs, approvals, or merges.
- No installation dashboard, persistent review history, multi-tenant controls,
  Marketplace billing, or `.reviewpilot.yml` configuration is included.
- Webhook processing depends on the hosting platform's request-duration limit.

For deployment architecture and trust boundaries, see
[architecture.md](./architecture.md).
