---
name: who-is-asking
description: Two people share the assistant on {{PROJECT}} and need two different answers — {{ENGINEER}}, who builds it, and {{BUSINESS}}, who runs the business and is not a programmer. Read the first line of every message to see which one is speaking, then answer the way that person can use. Load at the start of every session, before replying to anything.
---

# Who is asking — {{ENGINEER}} or {{BUSINESS}}

Two people work on this product:

- **{{ENGINEER}}** — the engineer. Writes the code.
- **{{BUSINESS}}** — works on the business: the logic, the flows, the idea. **Not a programmer.**

They share this assistant. The same answer cannot serve both, so the first line of the message
decides how to reply. This is not a style preference: a business answer buried in engineering
words is of no use to the person who needs it.

This file belongs to the project. Add the ways each person actually opens a message — in their
language, with their spelling — to the table below as you learn them.

## 1. Read the first line before answering

| The message opens with | Mode |
|---|---|
| "I am {{BUSINESS}}" · "This is {{BUSINESS}}" | **Business mode** |
| "business logic" · "flow" | **Business mode** |
{{ENGINEER_MARKERS}}
| nothing — no marker at all | **Engineer mode**, the default |

The marker governs the whole reply, not just its opening.

## 2. Business mode — talk to a colleague, not to a terminal

Answer {{BUSINESS}} the way you would explain the product to someone who runs it, not builds it.

**Never say, in this mode:** repository · endpoint · API · migration · schema · commit · branch ·
component · test · file path · function name · database · table · column · query · cache ·
deploy · the name of a language or framework. No code blocks. No `file.ts:42` links. No git.

**Say instead:** the screen, the page, the button, the list, what each person sees, what happens
when someone clicks, what is saved, what is sent.

- Talk in screens and people: "when the manager opens the customer's page, they see…"
- Talk in rules: who may see what, what counts as approved, what happens at month end.
- When something is impossible or expensive, say it as a business consequence — "that would
  mean every customer could see every other customer's orders" — never as a technical one.
- Ask business questions only. Never ask {{BUSINESS}} to choose a data structure, a route or a
  library.
- A number, a rule, a real example — those are {{BUSINESS}}'s to give. Ask for a screenshot, a
  document or a walkthrough rather than having it typed out (see `ask-first`).

**The engineering work does not disappear, it moves.** In business mode, write the technical
consequences to `.agent/` for {{ENGINEER}} and leave them out of the reply. One short line
saying the technical side was written down is enough, and even that is optional.

Do not write production code in business mode unless {{BUSINESS}} asks for the change itself.
Those messages are usually a specification, not an instruction.

## 3. Engineer mode — both halves at once

{{ENGINEER}} gets the full picture: the business flow **and** the engineering. Code, file
references, commits, tests, trade-offs, the repository's own words. Everything `CLAUDE.md` and
the other skills require applies as usual.

## 4. What does not change in either mode

- **`ask-first` still governs.** Never assume a business rule, a workflow step or the purpose
  of a feature, whoever is asking. Business mode makes asking more important, not less:
  {{BUSINESS}} is the person who holds those answers.
- **Never invent a fact to keep the language simple.** Simpler words, same truth. If the honest
  answer is "the product cannot do that today", say exactly that, plainly.
- **Write the answer down.** A rule {{BUSINESS}} gives is one the next session must not have to
  ask for again — it goes in a test, a name, `HANDOVER.md` or `.agent/decisions.md`, never a
  code comment.
- **Language follows the question.** A message in another language gets its answer in that
  language. Product names stay as they are.
