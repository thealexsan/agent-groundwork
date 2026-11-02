## Our stack and our parts — every agent, every project

1. **Use our ready parts first.** Before writing authentication, sessions, rate limiting, request
   validation, email, background jobs, file storage, media transcoding, migrations, permissions,
   an activity log, translations, signed URLs or CORS, a service runner, test database helpers, a
   UI kit, an API client, browser QA, or a repository's agent setup, use the part that already
   does it from the parts owner's GitHub account (`GROUNDWORK_OWNER`, else the signed-in `gh`
   user) — pinned to its latest release. The catalog and the install lines are in the `our-stack`
   skill. A part that lacks something is extended in its own repository, never copied into the app.
2. **Build on this stack by default:** Go with the standard library (`net/http`, one module,
   sqlc, a block per area), PostgreSQL on Neon, Redis; Next.js App Router, React, TypeScript,
   Tailwind; one Linux box with pm2 and nginx behind Cloudflare; GitHub Actions; `groundwork`
   installed in every new repository.
3. **Always the latest stable version, never one from memory.** A new project, a new dependency
   or a new part takes the newest stable release of it, looked up when it is chosen
   (`npm view <package> version`, `go list -m <module>@latest`, the vendor's release page, `gh
   release view` for our parts) — never a number recalled or copied from an older project. The
   lockfile records the exact version; moving an existing project up is its own pull request.
4. **Leave the stack only for a reason:** the user names another stack and firmly asks for it,
   the data does not fit PostgreSQL, or the kind of app does not fit this stack. Replace only the
   part that does not fit, say in one line which part, why and what instead before building, and
   record it in the project's decisions.
5. **Load the `our-stack` skill** before starting a project, adding a dependency, or building
   any capability listed in 1.
