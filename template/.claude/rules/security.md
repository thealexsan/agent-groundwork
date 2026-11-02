---
paths:
  - "**/*"
---

# Security rules

Security is correctness. A feature that leaks is a feature that does not work.

## Who is asking

1. **Every read and write is scoped to its viewer.** The account, tenant or owner comes from the
   authenticated session on the server, never from a parameter the client sent.
2. **Authorisation is checked on the server, on every request.** A hidden button is not a
   permission. The client is never trusted to say what it may do.
3. **A row that belongs to someone else answers as if it did not exist** — 404, or 403 where the
   existence is already known — and never with its contents.
4. **Operators and customers are different kinds of user**, with separate sign-in, separate
   sessions and separate routes. An operator is never a flag on a customer.
5. **Sensitive columns leave through one named path.** Pay, tokens, secrets and private notes are
   not part of the default serialisation of a record; adding a field to a response is a decision.

## Input

6. **Validate every external input** at the boundary: type, length, range, membership. Reject
   what is not expected rather than cleaning it.
7. **Parameterised queries only.** No SQL, shell command, file path or HTML built by joining
   strings with input. An identifier that must be interpolated is checked against a strict pattern.
8. **Uploads are untrusted bytes.** Check the real type, cap the size, re-encode images, store
   under a generated name, never execute or serve from a path the uploader chose.
9. **Redirects go only to an allow-listed destination.**

## Secrets and sessions

10. **No secret in the repository**, in a log, in an error message or in a URL. `.env.example`
    holds names, never values.
11. **Passwords are hashed with a slow hash**; an unknown account and a wrong password take the
    same time and give the same answer.
12. **A session changes its id at sign-in** and dies when the credentials change.
13. **State-changing requests carry a CSRF token** or are provably same-origin.
14. **Sign-in, reset and code endpoints are rate limited**, per account and per address.
15. **A link that grants access expires, is single-use where it can be, and is never logged.**

## Proving it

- A test proves the refusal, not only the success: the wrong role, the other tenant, the bad input.
- **Test with a second tenant.** A single-tenant fixture hides every cross-tenant bug.
- Never weaken a check, disable authentication or widen a permission to make a test pass.
- A new dependency is read before it is added: who maintains it, what it pulls in.
