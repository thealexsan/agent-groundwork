# SEO for {{PROJECT}} — the plan, and what it does not promise

**No plan can promise a permanent first place.** The search engine, competitors and the query
all move. What is achievable: the technical correctness a page needs to rank at all, then first
place for the specific long-tail queries this product can genuinely win, then rising visibility
on broader terms over months.

## 0. What is actually there today (checked YYYY-MM-DD)

Check each against the code, not memory, and write what is missing:

- `robots.txt` and `sitemap.xml`
- a distinct title and description per public page; the homepage's own, not an inherited one
- Open Graph and Twitter Card metadata with a real 1200×630 image
- structured data (JSON-LD): `Organization`, the product type, `FAQPage` where an FAQ exists
- a canonical URL on every public page; `hreflang` when there is more than one language
- whether the language is chosen by the URL or by a cookie — a crawler carries no cookie, so a
  cookie-chosen language means only one version is ever indexed
- Core Web Vitals measured against production

## 1. Phase 1 — technical foundation (no business decision needed)

1. `robots.txt` — allow the public pages; disallow the signed-in app, auth pages, media, and any
   API or admin host entirely.
2. `sitemap.xml` — every public route with its last modification.
3. A canonical URL on every public page — removes `www` against apex, trailing slashes and query
   strings as duplicates.
4. Open Graph and Twitter Card metadata — one image, reused; a distinct title and description per
   page; the locale matching what is served.
5. JSON-LD — `Organization` site-wide; the product on the homepage, with pricing only if it is
   public and accurate; `FAQPage` around an FAQ that already exists.
6. Re-measure Core Web Vitals against production, the same way every time — they are ranking
   signals, not only a budget.

## 2. Questions that need the owner before Phase 2

Each is a business decision. Ask for the source — a customer list, a sales call, a competitor's
page — not an opinion.

1. Which market and language should the homepage rank in first?
2. Who exactly is the buyer — role, company size, industry?
3. Which words do real customers use for the problem? From their emails, calls or search
   console, not from a keyword tool alone.
4. Which competitors rank for those words today, and what do they claim?
5. What can be said publicly — prices, customer names, numbers?

### Answers

Write each answer here with the date and who gave it.

## 3. Phase 2 — content (after §2 is answered)

A page per real problem a customer has, in their words, answering it better than what ranks
today. Native review for every language.

## 4. Phase 3 — authority (after §2 is answered)

Listings on the directories the buyer actually reads; links from genuine partners or press.

## 5. Measurement

- Weekly: search console impressions, clicks and position for the §2 queries; crawl errors.
- Monthly: Core Web Vitals against production, same method every time.
- Record what changed and what moved in `HANDOVER.md`. A ranking claim with no before and after
  is not evidence.

## 6. What this plan refuses

- Guaranteeing any ranking.
- Buying links or joining link schemes.
- Keyword stuffing, or near-identical pages per city or keyword.
- Machine-translated content without native review.
