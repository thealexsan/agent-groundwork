---
paths:
  - "**/app/**/*.tsx"
  - "**/app/**/*.ts"
  - "**/components/**/*.tsx"
  - "**/proxy.ts"
  - "**/middleware.ts"
  - "**/next.config.*"
---

# Next.js rules — the App Router, as installed

Next.js changes its conventions between majors and sometimes between minors. What you remember is
an older version; what is installed is the truth.

## The installed version first

1. **Read the installed docs before writing a convention from memory.** They ship in
   `node_modules/next/dist/docs/`; with npm workspaces `node_modules` is hoisted to the repo root.
   File names, the props a special file receives, and what is async all move between versions —
   a guess compiles and fails at runtime.
2. **The route types are generated.** `PageProps`, `LayoutProps` and `RouteContext` exist only
   after `next dev`, `next build` or `next typegen`; CI runs `npx next typegen` before `tsc`.
3. **Pin the version** and upgrade it on purpose, in its own pull request, never during feature
   work.

## Server and client

4. **A server component is the default.** `"use client"` goes on the smallest leaf that needs
   state, an effect or a browser API. `dynamic(..., { ssr: false })` is legal only inside a client
   module, so a lazy client widget gets its own file.
5. **A module that holds a secret or talks to the database imports `server-only`**, so a client
   import fails the build instead of shipping the secret.
6. **`NEXT_PUBLIC_*` is public and fixed at build time.** It is inlined into the bundle: never a
   secret, and a value missing at build is missing until the next build — often silently. Every
   build path, CI and by hand, sets the same list.

## Data

7. **Read on the server, per request, for anything belonging to a person.** Per-user data is
   never cached across requests; a cached row shown to the wrong person is not a latency trade.
8. **After a write, re-read from the server** (`router.refresh()` or revalidation) so the screen
   shows what the database says, not what the client hoped.
9. **A server action and a route handler are public endpoints.** Each one checks who is asking
   and validates its input itself — being called only from our own form proves nothing.
10. **`params`, `searchParams`, cookies and headers are input.** Parse and validate them; an
    unknown value falls back or answers 404, never throws a 500.

## Access

11. **A layout is not a gate for data.** A shared layout is not re-rendered on a soft navigation,
    and `proxy`/`middleware` only sees the request path. The API or the data function authorises
    every read; the layout's redirect is a convenience for the person, not the protection.
12. **A refused request is a state, not an error.** Render what the viewer may see; keep "not
    allowed" distinguishable from "nothing there".

## Every route has its states

13. **`loading`, `error` and `not-found` exist for each area of the app**, close to the pages
    they cover, so a slow or failed read never shows a blank screen or the framework's default.
14. **`<Link>` for internal navigation, `next/image` for images**, `metadata` or
    `generateMetadata` for each public page's title and description.
