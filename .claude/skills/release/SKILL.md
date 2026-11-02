---
name: release
description: Cut a version of groundwork — choose the number, run the gate, tag, publish the notes, and tell consumers what to change. Load before tagging, and before merging anything a caller can see.
---

# Releasing groundwork

A release is a git tag on `main`. Consumers install a tag, never a branch, so nothing reaches
them until this is done — and once it is done it cannot be taken back.

## 1. Choose the number

Read `git log <last tag>..main --oneline` and `git diff <last tag>..main -- README.md`.

| The change | While `v0.x` | From `v1` |
|---|---|---|
| A fix; no caller edits anything | patch | patch |
| Something added; old code still compiles and behaves | minor | minor |
| A caller must edit code, or a default, wire or cookie format changed | minor, flagged **breaking** | major |

When unsure whether something breaks a caller, it does.

## 2. Before tagging

1. `main` is what is being released, and CI on it is green — `gh run list --branch main --limit 1`.
2. Locally, on that commit:

   ```bash
   npm test
   ```

3. `README.md` describes the code as it now is. `HANDOVER.md` §5 has the story of anything
   non-obvious, and `NEXT_STEPS.md` no longer lists what was just done.

## 3. Tag and publish

```bash
git checkout main && git pull
git tag vX.Y.Z
git push origin vX.Y.Z
gh release create vX.Y.Z --title "vX.Y.Z" --notes-file <notes>
```

The notes, in this order:

- **Breaking** — each one with the exact edit a caller makes. Omit the heading when empty.
- **Added**
- **Fixed**

Written for someone who uses the library and has not read the diff.

## 4. Prove a consumer can install it

In a scratch directory outside this repository:

```bash
the install command a consumer uses, pinned to vX.Y.Z
```

and compile something that uses what changed. Delete the scratch directory afterwards.

## 5. Never

- Never move, delete or re-push a tag. Registries, proxies and lockfiles pin what a tag pointed
  at; a moved tag leaves two different trees under one version.
  A bad release is fixed by the next patch version.
- Never tag a commit that is not on `main`, or one whose CI is red or still running.
- Never release a breaking change without the **Breaking** section.

## 6. Consumers

This repository cannot see who imports it. After a breaking release, tell the user which
edit each consumer needs; do not open pull requests in other repositories unless asked.
