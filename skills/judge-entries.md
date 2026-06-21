# Skill: Judge Entries — Compare Two Entries Head-to-Head

## Trigger
Player says they want to judge. Or you offer judging after showing a question page.

## Prerequisites
- Player has a GitHub token
- Player has an identity
- The question has at least 2 entries (otherwise judging is impossible)

## The Golden Rules

1. **Never reveal identity during judging.** Strip all frontmatter before showing entries. The player must only see content — never author, display_name, links, or location.

2. **Never let a player judge their own entry.** Before picking entries to compare, check the `author` field in the frontmatter of each entry. If both entries have the same `author` as the player, fetch a different pair. A player can never judge their own work.

3. **One active entry per player per question.** The one-active-entry rule is enforced by validate.yml. A player cannot have more than one entry competing on the same question at the same time.

## Step 1: Pick Two Entries to Compare

You need two entry filenames from the question's entries directory. They must be from DIFFERENT authors — skip pairs where the author matches the player's identity.

Fetch the entries: `GET https://api.github.com/repos/HappyBrainCS/context-game/contents/wiki/qa/<slug>/entries`

Pick two entries using one of these strategies:

**Mode 1 — Judge player's entry vs specific ranking:**
Player says "judge mine against the current top answer." Fetch `wiki/qa/<slug>/index.md`, find the top-ranked entry, and fetch both files.

**Mode 2 — Random pair:**
Pick two entries with the fewest comparisons (check existing judgment files). This helps entries reach the minimum-5 threshold faster.

**Mode 3 — Judge two specific entries:**
Player says "compare #3 and #7." Map the ranks to filenames from `index.md`.

**Prevent duplicate comparisons:** Check existing judgment files for pairs involving the same two entries. Order-independent — (Echo vs Delta) blocks (Delta vs Echo).

## Step 2: Read Both Entry Files

Fetch each file from: `https://raw.githubusercontent.com/HappyBrainCS/context-game/main/wiki/qa/<slug>/entries/<filename>.md`

For each file:
1. Parse the YAML frontmatter (between the first `---` and second `---`)
2. **Discard all frontmatter** — author, display_name, links, location, supersedes — all of it
3. Keep only the body content (everything after the second `---`)
4. Shuffle the display order randomly (don't reveal which is entry_a vs entry_b)

## Step 3: Present Blindly

Show the player:

```
## Entry A

[First entry body — no frontmatter, no identity info]

---

## Entry B

[Second entry body — no frontmatter, no identity info]

---

Which is better?
1. Entry A wins
2. Entry B wins
3. Tie

Reason (optional, one sentence):
```

## Step 4: Record the Judgment

The player picks. Format the judgment:

```yaml
---
judge: <identity>
entry_a: <filename-a>
entry_b: <filename-b>
winner: <filename-a>      # or "tie" or <filename-b>
created: YYYY-MM-DD
reason: "<player one-sentence reason>"
---
```

## Step 5: Submit via GitHub API

1. Create a branch: `<identity>-judgment-<slug>-<timestamp>`
2. Commit the judgment file to `wiki/qa/<slug>/judgments/<identity>-<slug>-<timestamp>.md`
3. Create a PR

Judgment path: `wiki/qa/<slug>/judgments/<identity>-<first8-a>-vs-<first8-b>-<date>.md`
  - Use the first 8 characters of each entry filename (before the first `-`)
  - Example: `anon-a1b2c3d4-a1b2c3d4-vs-c5d6e7f8-2026-06-20.md`
  - This keeps filenames short and prevents collisions
Branch name: `<identity>-judgment-<slug>-<timestamp>`
PR title: `Judgment: <slug>`

## Step 6: Confirm

Say: "Judgment submitted! It'll update the Elo rankings once merged."

If the player gave a reason, you can add: "Your reason will be visible to the entry authors immediately, and to the public once the entry is in the Top 10."

## Edge Cases

| Situation | What to do |
|---|---|
| Only 1 entry exists in the question | Say: "This question only has one entry so far. Come back when someone else answers." |
| Player tries to judge their own entry | This is allowed. Blind judging means they won't know which is theirs. But if they do, the judgment still counts. |
| Player picks the same winner every time | That's fine. The Elo system handles streaks. |
| Player doesn't want to give a reason | Not required. Set `reason: ""` in the judgment file. |
| Existing judgment file for the same pair | Don't prevent it, but mention: "These two have been compared before. Your judgment still counts." |
