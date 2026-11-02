# Scaling {{PROJECT}} — the plan for what is not needed yet

Every item carries a **trigger** — something that can be measured — and nothing here is built
before its trigger fires. Every claim about the current system is checked against the code and
`DEPLOY.md` on the day it is written, not remembered.

## 0. Why this file is triggers and not tasks

Speculative architecture is paid for twice: once to build it, once to take it out when it did
not help. When something is built, measured and reverted, record it here with the number, so
nobody proposes it again without new numbers.

| What | Outcome | Where |
|---|---|---|
| | | |

## 1. What is actually running (checked YYYY-MM-DD)

| Part | What, where, how many | Its limit |
|---|---|---|
| Edge | | |
| Application processes | | |
| Database | | |
| Cache, sessions, queue | | |
| File storage | | |
| Background work | | |

## 2. The constraint no item below engineers around

Usually the risk is not throughput but that there is one of everything: one database with or
without a tested backup, one box, one person who knows how it fits. **Availability and recovery
come before capacity.** Write down what that is for this system, and what the first genuine
step out of it would be.

## 3. Do now — justified without a growth number

Only what is cheap, reversible, and fixes something already true: a backup that has never been
restored, retries without backoff, an alert that wakes nobody, a non-idempotent write a client
retries. Each row gets its pull request when done.

| # | Work | Why it does not need a trigger | Status |
|---|---|---|---|
| 1 | Restore the newest backup once, into a scratch database | A backup never restored is a belief | |
| 2 | An alert that reaches a person when the site stops answering | Metrics nobody is woken by are a dashboard | |

## 4. The trigger table — everything else

Nothing here is built until the middle column is true and **measured**, not estimated. When one
fires, the right-hand column is the first step only — re-plan from there.

| Want | Trigger — build it when this is true | First step when it fires |
|---|---|---|
| **Read replica** | The database's own statistics show reads saturating the primary, and the query budgets are already met | Streaming replica, reads routed per connection |
| **Partitioning** | One table passes tens of millions of rows, or a range query stops meeting its budget | Range-partition the biggest table only |
| **Separate cache instances** | Evictions are non-zero, or flushing the cache disrupts sessions | Split cache from sessions and queue; they need opposite eviction |
| **More caching** | A specific endpoint is measurably hot after its query budget is met | Conditional requests (ETags) before anything new on the server |
| **A message broker** | A second consumer of the same event actually exists | One consumer on the existing queue; dedupe on the event's id |
| **Circuit breakers** | An outage of a dependency has actually taken request workers down with it | Wrap the one dependency that broke. Not a framework |
| **Real-time push** | A named feature needs it | Decide where the connection is held first, then SSE for one-way |
| **Workflow engine** | A process has more than three steps, spans more than one system and must survive a restart mid-way | Until then the queue is the workflow engine |
| **API gateway** | A second backend exists to route between | The gateway arrives with the second service, never before it |

## 5. The ones that need a decision, not a trigger

Write each one here as: what was asked for, why it does not fit today, and what would change the
answer.

## 6. How to measure, before proposing any of it

- Measure on the production box, against loopback — never from a laptop. Run it twice; boxes
  vary.
- The database's statement statistics for what is slow; the per-endpoint query-budget tests for
  what regressed.
- The queue's wait time per queue, not "is the process alive".
- The cache's evictions and memory, and whether its workloads fight.
- **Record the before and the after** in the commit body or `HANDOVER.md`. Two numbers measured
  two different ways are not a comparison.

## 7. What this plan refuses

- Re-proposing anything §0 records as measured and refused, without new numbers.
- A rewrite because the architecture diagram looks better.
- Building anything in §4 to be ready. Ready is what this file is for.
