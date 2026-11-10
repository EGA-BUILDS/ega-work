# Authentication and the personal space

EGA Work uses Supabase Auth email passwords and magic links. Password sign-in
requires an existing account with a password in the configured Supabase project;
magic-link-only accounts do not automatically have one. The browser never supplies an
owner identity: `/me` renders only after the server verifies the session with
Supabase. This slice does not add a workspace database, service-role access, or
any hosted write.

## Configuration

Server environment:

```dotenv
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<publishable-or-anon-key>
SITE_URL=http://localhost:3000
```

The conventional `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
and `NEXT_PUBLIC_SITE_URL` names are also accepted. Prefer the server-only names
when the build and runtime configuration differ: Next.js inlines
`NEXT_PUBLIC_*` values at build time. Never set a Supabase service-role key in
this application.

Supabase project setup, performed outside this repository:

1. Enable the Email auth provider and email confirmation.
2. Set the Site URL to this application's origin.
3. Add the callback URL to **Redirect URLs**:
   - `http://localhost:3000/auth/callback` for local development
   - `https://<production-origin>/auth/callback` for each deployed origin
4. The default magic-link email template (`{{ .ConfirmationURL }}`) works with
   the PKCE `code` callback. A customized template can instead send:

   ```text
   {{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/me
   ```

Changing Supabase dashboard settings or sending email is a hosted operation and
is not performed by this repository's tests.

## Requests and files

| Path                         | Purpose                                                                 |
| ---------------------------- | ----------------------------------------------------------------------- |
| `app/login/page.tsx`         | Sign-in page, configuration state, link errors, authenticated redirect  |
| `app/login/actions.ts`       | Server actions for password and magic-link sign-in                      |
| `app/auth/callback/route.ts` | Verifies a PKCE `code` or email `token_hash`, then redirects internally |
| `app/auth/signout/route.ts`  | Same-origin POST sign-out                                               |
| `app/me/page.tsx`            | Protected personal space with verified identity and honest empty state  |
| `middleware.ts`              | Session refresh                                                         |
| `lib/supabase/server.ts`     | Request-scoped `@supabase/ssr` client backed by Next.js cookies         |
| `lib/supabase/middleware.ts` | Cookie refresh                                                          |
| `lib/auth/redirect.ts`       | Same-origin return-path validation                                      |
| `lib/auth/site-origin.ts`    | Trusted callback-origin resolution                                      |

Flow:

An existing account can also submit its email and password to the server action,
which calls `signInWithPassword` and redirects to the validated internal path on
success. Invalid credentials do not reveal whether an account exists.

1. `/login` submits a server action with an email address and an optional
   internal `next` path.
2. `signInWithOtp({ shouldCreateUser: true })` creates an account when the email
   is new and sends a magic link. The PKCE code verifier is stored in an
   HttpOnly cookie by `@supabase/ssr`.
3. The link returns to `/auth/callback`. The route exchanges the code (or
   verifies a token hash) and writes the session cookies.
4. The browser is redirected to the validated `next` path, or `/me` by default.
5. `middleware.ts` refreshes the session on application requests. The `/me`
   page verifies the user and redirects unauthenticated requests to `/login`.

## Security boundaries

- Identity comes from `supabase.auth.getUser()` on the server, not from a
  browser-supplied user ID, hidden field, or store value.
- Only the public anon/publishable key is used. There is no service-role client
  and no privileged database call.
- `next` accepts only a same-origin path. Absolute URLs, protocol-relative URLs,
  backslash tricks, control characters, and `/login` or `/auth/*` loops fall back
  to `/me`.
- The email callback origin comes from `SITE_URL`/`NEXT_PUBLIC_SITE_URL` when
  configured. Otherwise it comes from validated request headers for local and
  preview use. Supabase's Redirect URL allowlist is the final origin check, so
  every deployed origin must be listed there.
- Sign-out is POST-only and rejects a cross-origin `Origin` or `sec-fetch-site`.
- Auth redirects and auth responses send `Cache-Control: private, no-store` so a
  proxy cannot share session-bearing responses between users.

## States

| State                                     | Behavior                                                                               |
| ----------------------------------------- | -------------------------------------------------------------------------------------- |
| Missing or invalid Supabase configuration | The page renders a configuration alert; the form is not shown and no client is created |
| Invalid email                             | Server-side validation error; the form can be retried                                  |
| Email rate limited                        | A wait-and-retry message is shown                                                      |
| Email send failure                        | A retryable error is shown without exposing provider internals                         |
| Link sent                                 | Inbox confirmation with a resend option                                                |
| Expired or invalid link                   | Redirect to `/login?error=link` with a request-a-new-link message                      |
| Transient session verification failure    | `/me` shows a retry state instead of trusting the request                              |
| Sign-out failure                          | `/me?error=signout` reports that the session was not cleared                           |
| No saved projects                         | Empty personal-space state; no mock or shared records are shown                        |

## Verification

Focused checks for this slice:

```bash
corepack pnpm test:unit
corepack pnpm exec eslint <changed-files>
corepack pnpm typecheck
```

`pnpm test:unit` covers same-origin redirect validation, email validation,
configuration states, and callback-origin resolution. A production build and a
live Supabase magic-link journey require credentials and dashboard
configuration; they are not proven by these unit tests.

## Known limitations

- No project, issue, or workspace persistence exists yet. `/me` intentionally
  shows an empty state rather than mock or shared data.
- A PKCE magic link must normally be opened in the browser that requested it,
  because the code verifier lives in that browser's cookie.
- There is no password setup or reset, OAuth, passkey, account-management, or admin surface.
- Email delivery, dashboard redirect allowlists, rate limits, and hosted session
  behavior must be verified in the target Supabase environment.
