---
paths:
  - "**/*"
---

# Performance rules

Measure first. A change made for speed without a number before and after is a guess.

## Database

1. **No query inside a loop.** Load related rows in one query; count the queries a screen makes.
2. **Every filter and sort a list uses has an index** that matches it, including the tenant or
   owner column first.
3. **Every list is paged or capped.** Nothing returns "all rows".
4. **Select what the response needs**, not every column.
5. **A slow query is fixed at the query** — an index, a narrower select, a different shape —
   before a cache is put in front of it.

## Caching

6. **A cache key carries everything the answer depends on**: tenant, viewer, locale, date.
   A key that is too coarse shows one person another person's data.
7. **Invalidate on write, by name or by version** — not by a short lifetime and hope.
8. **Per-viewer data is never cached where another viewer can read it**, in a shared cache or a CDN.

## Requests

9. **Slow work leaves the request.** Mail, transcoding, exports, third-party calls: enqueue, answer,
   finish in a worker. A handler that is safe to run twice is the price.
10. **Independent reads run in parallel**, dependent ones in order.
11. **Every outbound call has a timeout** and a decision about what the page does when it fails.

## Frontend

12. **Ship less.** Server-render what does not need the browser; lazy-load what is below the fold
    or behind a click; one animation runtime, not three.
13. **Images have dimensions, a modern format and a size that fits where they are shown.**
14. **Heavy components — WebGL, charts, editors, viewers — are loaded on demand**, never in the
    shared layout.
15. **A list that can grow is virtualised or paged.**

## Proving it

- State the number: queries per request, response time, bytes shipped, before and after.
- A load test runs against something shaped like production, never a laptop's empty database.
