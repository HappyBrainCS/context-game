# Skill: Submit Entry — Write and Submit a Player's Answer

## Trigger
Player says they want to write an answer to a question.

## Prerequisites
- Player has a GitHub token (from `~/.config/context-game/github-token`)
- Player has a fork (from `~/.config/context-game/fork-owner`)
- Player has an identity (from `~/.config/context-game/identity`)
- The question slug is known (e.g., `whats-the-best-disc-golf-course-in-cedar-city`)

## Step 1: Check for Existing Active Entry

Before writing, check if the player already has an entry for this question.

Fetch the entries directory from the **upstream**: `GET https://api.github.com/repos/HappyBrainCS/context-game/contents/wiki/qa/<slug>/entries`

Search for any file starting with the player's identity hash. If found, note the filename — the player is updating an existing entry, not creating a new one.

## Step 2: Ask the Player for Their Answer

Say: "What's your answer? I need a headline (1-line summary) and a few sentences explaining your reasoning."

The player provides their content. Format it:

```yaml
---
title: "<Player's headline — one clear takeaway>"
author: <identity>
created: YYYY-MM-DD
display_name: "<from profile>"
links: "<from profile>"
location: "<from profile>"
---

<Player's answer content — 2-5 sentences minimum>

## Details

<Optional: deeper explanation, examples, analysis>

## Sources

<Optional: links, references, citations>
```

## Step 3: Handle Supersedes (If Updating)

If the player already has an active entry:
1. The old filename (e.g., `anon-a1b2c3d4-2026-06-15.md`) must move to `archived/`
2. The new entry must include `supersedes: anon-a1b2c3d4-2026-06-15.md` in the frontmatter
3. Both the archive move and the new entry are submitted in the same PR

If this is the first entry for this question, no `supersedes` field is needed.

## Step 4: Submit via GitHub API

Follow the API pattern in `skills/github-api.md`:

1. Create a branch: `anon-a1b2c3d4-entry-<slug>-<timestamp>`
2. Commit the new entry file to `wiki/qa/<slug>/entries/<identity>-<date>.md`
3. If superseding: The GitHub API doesn't have a "move" operation. You must:
   a) DELETE the old file from entries/: `DELETE /repos/{owner}/{repo}/contents/wiki/qa/{slug}/entries/{old-filename}`
   b) PUT the old content into archived/: `PUT /repos/{owner}/{repo}/contents/wiki/qa/{slug}/archived/{old-filename}`
   Both go on the same branch. Two commits, one PR.
4. Create a PR with a clear title and body

New entry path: `wiki/qa/<slug>/entries/<identity>-<YYYY-MM-DD>.md`
Branch name: `<identity>-entry-<slug>-<timestamp>`
PR title: `Entry: <slug>`

## Step 5: Confirm

After submission, say: "Your entry is submitted! It'll appear on the question page once the PR is reviewed and merged. I'll let you know when it goes live."

Show the PR URL: `https://github.com/HappyBrainCS/context-game/pull/<number>`

You can optionally enable auto-merge on the PR so it merges automatically once CI passes:

```
PATCH /repos/HappyBrainCS/context-game/pulls/{number}
Authorization: Bearer {TOKEN}
Body: { "auto_merge": { "merge_method": "squash" } }
```

Do NOT use `PUT /pulls/{number}/merge` — that merges immediately, bypassing validation. The PATCH with `auto_merge` waits for all status checks to pass.

If auto-merge is enabled, the entry goes live without waiting for a human reviewer.

## Edge Cases

| Situation | What to do |
|---|---|
| No GitHub token | Tell the player: "I need a GitHub token to submit. Run the setup first." |
| PR merge fails (validation) | Read the Action log, fix the issue, push to the same branch. |
| Branch already exists | Add a new timestamp. |
| Player doesn't have a headline | Ask for one. It's required — it shows in the Top 10 comparison. |
| Player's content is too short (< 2 sentences) | Suggest adding more detail. Short entries tend to lose judging. |
