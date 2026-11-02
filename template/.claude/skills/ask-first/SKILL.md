---
name: ask-first
description: "MANDATORY for product thinking — business logic, feature workflows, and the ideas themselves. Never assume a rule, never invent a flow, never guess what a feature is for. Stop and ask the user, and ask for the screenshots, explanations, roadmaps, diagrams and md files behind the answer. Load at the start of every session and re-read before writing anything that encodes a business rule."
---

# Ask first — product logic is the user's, not yours

This is not advice. It is the standing rule for this repo, given by the user directly:
when the subject is **business logic, the workflow of a feature, or the idea itself**,
ask about everything. Do not talk in assumptions.

A wrong line of code is found by a test. A wrong business rule ships, looks correct,
and is discovered by a customer. That asymmetry is why this rule exists.

## 1. What this covers

Load and follow this skill the moment the work touches any of these:

- **Business rules** — who may see what, what counts as approved, how a balance is
  earned or spent, what a price includes, what a status transition means, what happens at
  a boundary (period end, cancellation, a rejected request).
- **Feature workflows** — the steps a user walks through, who acts at each step, what
  each role sees, what happens on cancel, reject, retry, expiry or a second approver.
- **The idea itself** — what a feature is for, which problem it solves, who asked for
  it, what "done" means, whether it belongs in this product at all.
- **Domain vocabulary** — what a word means in this business before it becomes a column,
  an enum, a route or a label.
- **Anything the user described in a sentence and you are about to turn into a screen.**

## 2. What it does not cover

Ordinary engineering judgment is still yours, and asking about it wastes the user's time:

- Which file, which component, which hook, which query, which index.
- Naming, folder placement, test structure, refactor shape.
- Design choices already settled in the project's design system.
- Anything the repository already answers — read the code, the migration, the test,
  `HANDOVER.md` or `NEXT_STEPS.md` first. **An answer that exists in the repo is not
  a question.**

Read before asking. Ask only what the repo cannot tell you.

## 3. The rule

**No assumption about product logic may reach code, a schema, a test or a document.**

When you hit a gap:

1. Stop. Do not pick the "reasonable" default and keep going.
2. Do every part of the task that does **not** depend on the answer.
3. Ask — concretely, with the options you actually see, and say what each one would
   cause you to build.
4. Wait for the answer before writing the part that depends on it.

Phrases that mean you are about to break this rule — treat each as a stop sign:

> "presumably" · "it probably means" · "the standard way is" · "I'll assume for now" ·
> "typically a system like this would" · "this should be fine as a default" · "I'll make it
> configurable so it does not matter"

Making it configurable is not a substitute for asking. It doubles the code and still
guesses the default.

## 4. Ask for the source, not just the sentence

The user has a lot of this written down already. Always offer the cheaper path and name
what you can use:

- **a screenshot** of the screen or the tool they are replacing
- **a roadmap or a plan** they already wrote
- **a diagram** — a flow, a state machine, boxes and arrows, a photo of paper
- **an `.md` file** anywhere on their machine, dropped into the repo or pasted
- **an existing document** — a contract, a spec, a rules page, a spreadsheet
- **a walkthrough** — "click through it and tell me what you see at each step"
- **a real example with real numbers** — one concrete case beats five abstract rules

Say it plainly: *"Screenshot or an md file is faster than typing it out."*

## 5. How to ask

- Use `AskUserQuestion` when there are two to four real alternatives, with a short
  description of the consequence of each. Put your recommendation first.
- Use plain text when the answer is open — a rule, a number, a list, a walkthrough.
- **Batch the questions.** Read enough first to ask everything at once, not one
  question per turn.
- Ask about the boundaries, not the happy path — the happy path is usually obvious and
  the edges are where the business rule actually lives.
- Never bury the question at the end of a long report. Ask it first, in its own lines.

## 6. Where the answer goes

An answer given in chat is lost at the end of the chat. Every product answer gets a
durable home in the same unit of work:

- a **test** that asserts the rule, named after the rule
- a **constant or a type** that carries the vocabulary
- `HANDOVER.md` §5 or §6 for a gap or a trap
- `NEXT_STEPS.md` for ordered work
- `.agent/decisions.md` while the work is still in flight
- and never a code comment — see the `no-inline-comments` skill

If you had to ask for it, write it down. The next agent must not have to ask again.

## 7. When the user has already decided

If the user answers, that is the answer — build it, even if you would have chosen
differently. State a concern once, in a sentence or two, then implement what they said.
Repeating the objection is not diligence.
