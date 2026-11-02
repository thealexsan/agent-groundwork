---
paths:
  - "**/*.tsx"
  - "**/*.jsx"
  - "**/*.ts"
  - "**/*.js"
  - "**/*.css"
  - "**/package.json"
---

# Page-weight rules — as light as it can be

Every kilobyte is paid on someone's phone over mobile data. Weight is a budget, not a cleanup task.

## Budgets

| Page | First-load JS, gzipped, production build | Last measured |
|---|---|---|
| Public landing page | ≤ 300 KB | not measured — measure before changing it |
| Sign-in | ≤ 250 KB | not measured — measure before changing it |
| A signed-in screen | ≤ 350 KB | not measured — measure before changing it |

A change that grows a budgeted page records before and after in the commit body. Going over a
budget needs a sentence saying what the bytes buy.

## Server first

1. **Render on the server by default.** Client code goes on the smallest leaf that needs state, an
   effect or a browser API — never on a module shared by server pages. When one component in a
   shared file needs a hook, move it to its own file.
2. **Never pass a component or a function from server code into a client component.** Render the
   element on the server, or keep the component on the server side.
3. **Fetch on the server and send what is shown.** A client component receives the rows it
   renders, not a month of data to slice.

## Heavy things load late

4. **Charts, editors, viewers, the camera and the command palette load when opened**, never at
   page load, and never from a module the public pages import. Anything over ~20 KB gzipped that is
   not on screen at first paint is loaded on demand. A sparkline is a plain SVG.
5. **No new dependency for something under ~50 lines of our own code.** Before adding one, check
   its gzipped size and whether the project already has something that does it.
6. **Import icons one by one**, never a whole set, and let the bundler tree-shake the libraries
   that support it.

## Payload

7. **The dictionary is a hidden cost.** A page should not ship every key of every screen; split it
   by area once it grows.
8. **Images are a modern format, sized on the server**, always carry width and height so nothing
   shifts, and load lazily below the fold.
9. **One font family, self-hosted and subset.** No runtime font CSS from a third party.
10. **No polling faster than the thing changes.** Anything heavier than a cheap read needs an
    event, not a timer.

## Things measured and rejected

Record each optimisation that was measured and not worth it — what, the numbers, and when to
measure again — so nobody tries it twice blind.

## How to measure

Build for production, load the page from the production server, and sum the transferred script
bytes. Use the same compression on both sides and compare page totals, never one chunk. `curl`
does not ask for compression unless told to.
