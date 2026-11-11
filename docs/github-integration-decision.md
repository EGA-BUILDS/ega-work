# GitHub integration decision

Status: **implemented in code; live provider acceptance not performed.** No
GitHub App credentials or test installation exist in this environment. The
feature is disabled and hidden when its configuration is absent, and v1.0
workspace behavior is unchanged.

## Decision: GitHub App with user-to-server tokens

EGA Work uses a GitHub App and the user authorization web flow. It does not use
a classic OAuth App, an App private key, installation access tokens, webhooks,
polling, or a background worker.

| Concern            | This integration                                                   |
| ------------------ | ------------------------------------------------------------------ |
| Credential         | Short-lived user-to-server token, refreshed with a rotating token  |
| Repository access  | The intersection of the user's access and the App installation     |
| Permissions        | Pull requests: read-only; Metadata: read-only                      |
| Workspace scope    | One connection and one selected installation per workspace         |
| Provider authority | GitHub owns PR observations; Work owns issue status                |
| Revocation         | Disconnect locally, revoke the token, optionally uninstall the App |

No contents, checks, reviews, write, or administration permission is requested.
The integration never creates, merges, comments on, or closes a pull request.
A PR observation never changes `work_issues.status`.

## Authorization flow

1. `POST /api/workspaces/{workspaceId}/github/connect` requires a verified
   session and an owned workspace. It creates a random 32-byte state value,
   stores only its SHA-256 hash with the user, workspace, observed connection
   generation, and a 10-minute expiry, and encrypts the PKCE verifier.
2. The browser is sent to the fixed GitHub URL
   `https://github.com/login/oauth/authorize` with the client id, the callback
   URL, `state`, `code_challenge`, `code_challenge_method=S256`, and
   `scope=offline_access`.
3. GitHub returns to `GET /api/github/callback`. This is a top-level cross-site
   navigation, so no same-origin check applies. The route still requires a
   verified Supabase session, consumes the state row atomically, decrypts the
   verifier server-side, exchanges the code at the fixed
   `https://github.com/login/oauth/access_token` endpoint, and proves identity
   with `GET /user` on `https://api.github.com`.
4. The saved connection is only updated when the generation recorded in the
   state is still current. A replayed, expired, altered, cross-user, or denied
   callback leaves the existing connection untouched.
5. `GET /api/github/setup` is the App setup URL. Its `installation_id` value is
   an untrusted hint and is ignored. The route redirects to the user's internal
   settings. Installation selection only accepts ids returned by the verified
   `GET /user/installations` enumeration.

The callback and setup URLs must be registered on the GitHub App for each
deployed origin:

- `https://<origin>/api/github/callback`
- `https://<origin>/api/github/setup`

## Data and credential handling

- `work_github_connections` stores the GitHub numeric user id, login, encrypted
  access and refresh tokens, expiry times, selected installation, generation,
  token version, and refresh lease. Tokens are AES-256-GCM encrypted with a
  random 96-bit IV and an authentication tag. Decryption failure fails closed.
- `work_github_oauth_states` stores only the SHA-256 state hash and encrypted
  PKCE verifier. Rows are single-use and expire.
- `work_pull_requests` stores owner, repository, number, canonical URL, title,
  state, last successful check time, a fixed error code, and refresh attempt
  metadata. Metadata is hidden and cleared on disconnect.
- Refresh tokens rotate and are single-use. A durable lease is claimed with a
  compare-and-set before calling GitHub, then finalized only when the lease,
  connection generation, token version, row identity, and refresh attempt still
  match. A concurrent request re-reads once and returns a retryable conflict if
  the lease is still held. Consumed refresh tokens are never retried in a loop.
- Tokens never appear in browser payloads, URLs, logs, error messages, tests, or
  git. No provider response text is echoed to the browser.

## Error behavior

The browser sees only a fixed taxonomy: `unconfigured`, `disconnected`,
`reauthorization_required`, `installation_unavailable`, `not_found`,
`rate_limited`, `outage`, `denied`, `conflict`, and `invalid_input`.

- A definitive 401 or lost authorization marks the connection unusable, clears
  tokens, hides PR metadata, and requires reconnect.
- A lost installation or repository permission does the same.
- A timeout, 5xx, or rate limit preserves the last successful observation,
  marks it stale, and shows a retry action while the connection remains
  authorized.
- Unlink or disconnect during an in-flight refresh commits zero rows. A late
  response cannot restore a link or expose removed data.

## Required server configuration

| Variable                         | Purpose                                                       |
| -------------------------------- | ------------------------------------------------------------- |
| `GITHUB_APP_CLIENT_ID`           | GitHub App client id                                          |
| `GITHUB_APP_CLIENT_SECRET`       | GitHub App client secret                                      |
| `GITHUB_APP_SLUG`                | App slug used for the install link                            |
| `WORK_TOKEN_ENCRYPTION_KEY`      | Base64 32-byte AES-256-GCM key                                |
| `WORK_GITHUB_DATABASE_URL`       | Restricted runtime login that is a member of the runtime role |
| `WORK_GITHUB_DATABASE_CA_BASE64` | Optional base64 database CA for verified TLS                  |

Configuration is read server-side. There is no `DATABASE_URL` fallback, no
`service_role` key, and no privileged migration credential at runtime. A
missing or malformed value disables the feature rather than throwing at import.

Provisioning is operational, not part of a migration: the owner creates a
LOGIN role that is a member of `work_github_runtime` and stores its connection
string in `WORK_GITHUB_DATABASE_URL`. See
[database.md](database.md#github-runtime-role). Never commit or migrate a
password.

## Rotation and revocation

- Rotate `WORK_TOKEN_ENCRYPTION_KEY` by disconnecting affected workspaces,
  rotating the key, and reconnecting. Existing ciphertext cannot be decrypted
  with a new key; this is intentional.
- Rotate the App client secret and client id in GitHub, then update the server
  environment and reconnect workspaces as needed.
- Disconnecting locally bumps the connection generation, invalidates OAuth
  states and leases, deletes usable tokens, and hides stored PR metadata. Token
  revocation is attempted best-effort after the local transaction commits.
- Uninstalling the GitHub App from an account or repository is a separate
  GitHub action. Uninstall or lost access makes refresh fail closed and requires
  reconnect or a new installation.
- The owner remains responsible for auditing the App, its permissions, its
  installations, and its client secret.

## Explicit non-claims

- No live connection, installation, PR link, refresh, or revocation has been
  observed in this environment.
- There is no webhook receiver, polling loop, background job, PR creation, merge
  action, or issue synchronization.
- The user-to-server token flow is implemented and unit/database-tested offline;
  provider acceptance with a disposable installation remains an owner step.
