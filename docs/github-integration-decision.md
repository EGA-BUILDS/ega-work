# GitHub integration decision

Status: **recommendation, not confirmed**. Issue #13 is an owner decision. No
GitHub credential or test repository is configured in this checkout, so issues
#14–#16 are blocked until the owner confirms the provider setup.

## Recommendation: GitHub App

Use a GitHub App installed on selected repositories, not a classic OAuth App.

| Concern              | GitHub App (recommended)                          | OAuth App                     |
| -------------------- | ------------------------------------------------- | ----------------------------- |
| Repository selection | Installation chooses repositories                 | User-wide repository scope    |
| Permissions          | Pull requests: read, Metadata: read               | Broad repo scope              |
| Credential           | Short-lived installation token minted server-side | Long-lived user token         |
| Revocation           | Uninstall/revoke the installation                 | Revoke the user authorization |
| Workspace scope      | One installation can be bound to one workspace    | Token is user-wide            |

The first release only needs to read pull-request title, canonical URL, and
open/closed/merged state. It does not need contents, checks, reviews, or write
access.

## Required owner inputs

1. Create the GitHub App under the owning account/org.
2. Set the callback URL to `https://<deployed-origin>/api/github/callback` for
   each Beta and Stable origin (exact origins, no wildcard).
3. Grant only **Pull requests: read** and **Metadata: read**. Do not grant
   contents or write permissions.
4. Choose a disposable test repository and a test pull request.
5. Configure server-side values: `GITHUB_APP_ID`, `GITHUB_APP_SLUG`,
   `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_CLIENT_ID`,
   `GITHUB_APP_CLIENT_SECRET`, and a 32-byte `WORK_TOKEN_ENCRYPTION_KEY`.
6. Confirm who owns the App, how it is revoked, and whether Beta and Stable use
   the same App or separate installations.

Do not enable the integration in production before the owner confirms these.

## Callback and state design

- `GET /api/github/connect` requires a verified session and a workspace the
  user owns. It creates a random state value, stores only its SHA-256 hash with
  the user, workspace, and a 10-minute expiry, then redirects to GitHub.
- `GET /api/github/callback` requires a verified session, looks up the unconsumed
  state hash, and rejects missing, altered, expired, replayed, or cross-user
  state. It consumes the state in the same transaction that stores the
  installation.
- The callback binds `installation_id` to the workspace. A second workspace
  cannot reuse the connection.
- Installation tokens are minted on demand from the App private key, cached only
  server-side with a short expiry, and never sent to the browser or written to
  logs. Store the installation id and an encrypted token cache, not a
  long-lived user token.
- Disconnect deletes the usable credential and records that provider-side
  uninstall is a separate owner action. Revoked or denied access marks the
  connection unusable and hides stored private PR details.

## PR linking and refresh rules

- Accept only `https://github.com/<owner>/<repo>/pull/<number>`; reject other
  hosts, credentials, ports, query strings, and non-PR paths.
- Parse owner/repo/number and call GitHub with those values. Never fetch a
  user-supplied URL.
- Verify the installation can see the repository before storing or displaying
  PR data.
- Store title, canonical URL, state, last successful check time, and the last
  error. A failed refresh preserves the last observation and marks it stale only
  while authorization still exists.
- GitHub owns PR state; Work owns issue state. No refresh, close, or merge
  changes the issue's open/completed status.
- Concurrent refreshes must not replace a newer observation with an older one;
  a refresh finishing after unlink or disconnect must not restore the link.

## Test plan for #14–#16

- Connect a disposable installation, reload, disconnect, and verify the token
  is not in any client payload or log.
- Reject altered, expired, replayed, and cross-user callbacks.
- Link a real PR, reload, refresh open/closed/merged states, and unlink.
- Deny a private repository the installation cannot see; verify no title or URL
  leaks before authorization.
- Simulate a provider outage (stale observation, actionable error) separately
  from revoked access (hide details, require reconnect).
- Complete an issue, then merge the PR and refresh: the issue stays completed.
- Repeat the refresh race after unlink/disconnect.

## Non-claims

No GitHub connection, PR link, or refresh is implemented or verified in this
release candidate. The workspace settings and issue detail deliberately show
GitHub as unavailable rather than faking a connection.
