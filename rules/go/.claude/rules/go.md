---
paths:
  - "**/*.go"
  - "**/go.mod"
  - "**/*.sql"
---

# Go rules

Boring Go: the standard library, one module, SQL that is checked at build time, and tests against
the real database.

## Layout

1. **One Go module.** No second `go.mod`, no `pkg/`, no `utils`, `common` or `helpers` package.
2. **A package is named for what it is**, and code moves into a shared package when a second
   caller needs it, not before.
3. **Standard library first**: `net/http` with method patterns, `log/slog`, `encoding/json`. No
   web framework, no ORM, no dependency-injection container, no assertion library. A new
   dependency needs a reason the standard library and the existing `go.mod` cannot meet.
4. **A process binds to `127.0.0.1`** unless it is the edge. Only the proxy reaches it.
5. **When the project splits into services, each restarts alone and goes down alone.** A service
   never imports another service's package and never calls it in the middle of a request; what
   two need comes from a shared package or the database. A page that reads a service that is
   down still loads and says those figures are unavailable.

## Database

6. **Queries are written as SQL and generated into Go** (sqlc), not built from strings. SQL lives
   in `.sql` files, generated code is never edited by hand, and both are committed. CI fails when
   regenerating changes anything.
7. **Migrations are the schema's only history.** Applied in name order, each in one transaction.
   A file that has shipped is never edited; a change is a new file.
8. **One writer per table.** A package writes only the tables it owns; reading another's is fine.
   An audit log is appended to, never updated or deleted.
9. **Every query is scoped to the viewer** — tenant or owner first — by a parameter that comes
   from the authenticated request. A query without that filter has a test proving another
   tenant's rows never appear.
10. **Aggregate in SQL, not in Go**, and count the queries a request makes.

## Identity

11. **A handler never reads a session or a token.** Middleware authenticates and puts the viewer
    on the context; the handler asks the context.
12. **Permissions are evaluated on the server from the database**, never from a header or the
    client.

## Code

13. **No comments.** Allowed: `//go:` directives, `//lint:ignore` with the check named, and the
    `-- name:` lines sqlc requires.
14. **Errors are returned, wrapped with `%w` where the caller needs context, and logged once** at
    the handler. No `panic` outside `main`; an ignored error is written `_ =` and only on a close
    or a write to a response.
15. **`context.Context` is the first parameter** of anything that touches the database, a cache or
    the network, and it is the request's context.
16. **Time comes in as a parameter** (`now func() time.Time`), never `time.Now()` inside a rule.
    Dates are calendar days in the business's time zone. Money is integer minor units, never a
    float.
17. **The HTTP contract changes on purpose or not at all.** Paths, JSON keys, status codes and
    error messages are what clients depend on; a rewrite behind them keeps them.

## Background work

18. **Work that leaves the request is enqueued in the same transaction** as the write that needs
    it. A job stops when its context is cancelled and is safe to run twice. A job that can leave a
    row half done names what undoes it once its last attempt is spent.
19. **A job queue that brings its own migrations is a second schema history.** Prefer one on a
    table the project's migrations own.

## Tests

20. **Tests use the real database and cache**, a fresh database per test. No mocks of the
    database. Test names are sentences about behaviour.
21. **A test proves the refusal, not only the success**: the other tenant, the wrong role, the bad
    input.

## Gates, before every commit that touches Go

```bash
test -z "$(gofmt -l .)"
go vet ./...
go run honnef.co/go/tools/cmd/staticcheck@v0.8.1 ./...
go run github.com/sqlc-dev/sqlc/cmd/sqlc@v1.31.1 generate && git diff --exit-code .
go test ./...
```

Run them from the module's root. The whole suite on a large module is for CI; while iterating,
test the package you changed.
