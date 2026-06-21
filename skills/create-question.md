# Skill: Create Question — Make a New Question When None Matches

## Trigger
Player asks a question that doesn't match any existing question in the index. Player says yes when you offer to create one.

## Prerequisites
- Player has a GitHub token
- Player has an identity

## Step 1: Confirm the Question

Ask the player: "What exactly should the question be?"

Nail down:
1. **The question text** — clear, specific, not too broad
   - Good: "What's the best way to learn Spanish as an adult?"
   - Too broad: "How does language work?"
2. **Keywords** — 2-5 terms that help future players find this question
3. **Optional: Location tag** — only if the question is about a specific place

## Step 2: Generate the Slug

Convert to URL-friendly:
- Lowercase, hyphenated
- Remove special characters
- Keep readable

Example: "What's the best way to learn Spanish as an adult?" → `whats-the-best-way-to-learn-spanish-as-an-adult`

## Step 3: Create Just Two Files

The GitHub Contents API auto-creates parent directories. You only need to create the files that have content:

### File 1: `question.md`

```yaml
---
title: "What's the best way to learn Spanish as an adult?"
created-by: <identity>
created: YYYY-MM-DD
phase: collecting
keywords:
  - spanish
  - language learning
  - keywords here
---
```

### File 2 (optional): First entry

If the player wants to write the first answer:

```yaml
---
title: "<One-line headline>"
author: <identity>
created: YYYY-MM-DD
---

<Answer content>
```

That's it. Two API calls:
1. Create `wiki/qa/<slug>/question.md`
2. Create `wiki/qa/<slug>/entries/<identity>-YYYY-MM-DD.md` (optional)

No .gitkeep files needed. The directories are created automatically by the API.

**Important:** Do NOT create any index files (`index.md`, `wiki/index.md`, `wiki/agent-index.json`). Those are auto-generated on merge.

## Step 4: Submit via GitHub API

1. Create branch: `<identity>-question-<slug>-<timestamp>`
2. PUT question.md to `wiki/qa/<slug>/question.md`
3. PUT initial entry (optional) to `wiki/qa/<slug>/entries/<identity>-YYYY-MM-DD.md`
4. Create PR

PR title: `Question: <title>`
PR body: `New question from <identity>`

## Step 5: Confirm

Say: "New question created! It's at `wiki/qa/<slug>/`. The index will update once the PR merges. Other players can now find it, write entries, and judge."

PR URL: `https://github.com/HappyBrainCS/context-game/pull/<number>`

## Step 6: Re-Fetch the Index

After the PR merges, re-fetch `agent-index.json` so your cached index is up to date.

## Edge Cases

| Situation | What to do |
|---|---|
| Player asks a question that already exists | Guide them to the existing question. Don't create a duplicate. |
| Question slug already exists | Append a distinguishing word to make it unique. |
| Player wants to ask a very broad question | Suggest narrowing it. Broad questions get broad answers. |
| No GitHub token | Tell the player: "I need a token to create questions. Run setup first." |
