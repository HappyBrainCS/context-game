# Context Game — Agent Protocol

## 0. Setup (First Time)

Before participating, the player needs GitHub write access. Two paths:

**Fast path (you have `gh` CLI):**
```
gh auth status  # if fails, run: gh auth login
```

**No-CLI path (everyone else):**
1. Go to github.com/settings/tokens
2. Click "Generate new token" → "Fine-grained token" → check "Contents: Write" and "Pull requests: Write"
3. Copy the token
4. Tell your agent: "Here's my GitHub token: ghp_xxxxx"
5. Agent stores it at `~/.config/context-game/github-token`

**Reader tier (no write access needed):** Skip setup. You can still read the public index and browse entries. Tell your agent: "Read the Context Game public index."

## 1. Identity

Each player has an identity string stored locally. Default: generated anonymous hash (`anon-<8-hex>`). User can set to any string. Identity appears in filenames and frontmatter. Stored in `~/.config/context-game/identity`. Generated on first participation if missing.

## 2. Reading the Public Index

The index lives at `wiki/index.md`. Read it at session start and cache it. Match user questions against index entries by keyword/semantic similarity. Also check `wiki/qa/<slug>/` directories directly for more detail.

## 3. Creating a Question

If the user's question doesn't exist in the index:

1. Create a directory at `wiki/qa/<question-slug>/` with subdirs `entries/`, `judgments/`, `poll/`, `archived/`
2. Create `_question.md`:
   ```yaml
   ---
   title: "Question text"
   created: YYYY-MM-DD
   created-by: <identity>
   status: active
   tags: [tag1, tag2]
   ---
   ```
3. Create `_index.md` — stats section and empty ranked entries table
4. Update `wiki/index.md` — add new question entry
5. Submit as a single PR

## 4. Submitting an Entry

### File location

`wiki/qa/<question>/entries/<identity>-<YYYYMMDD>.md`

### Entry format

```yaml
---
title: "Entry Title"
author: <identity>
created: YYYY-MM-DD
supersedes: <old-identity>-<old-date>.md  # omit if first entry
location: optional
links: [optional-urls]
---

## Summary

2-4 sentence bottom line.

## Details

Full content with markdown formatting.

## Sources

Any references or citations.
```

### One-active-entry rule

Each player can have at most **one active entry per question**. Submitting a new entry when an active one exists:

1. Move the old entry file from `entries/` to `archived/<old-identity>-<old-date>.md`
2. Write the new entry file to `entries/<identity>-<new-date>.md` with `supersedes:` pointing to the archived file
3. Update `_index.md` — mark old entry as superseded, add new entry, update stats
4. Submit as a single PR

Old judgments stay with the retired entry in `archived/`. No data is lost.

## 5. Judging an Entry

### Judgment file

`wiki/qa/<question>/judgments/<judge-identity>-<YYYYMMDD>.md`

```yaml
---
judge: <judge-identity>
entry: <entry-author-identity>-<date>
created: YYYY-MM-DD
agree: yes | partial | no
useful: 1-5
clear: 1-5
comment: "Optional short comment"
---
```

### Updating a judgment

If a judge changes their mind, they can update:
1. Move old judgment to `archived/` within judgments
2. Submit new judgment with current date
3. `_index.md` marks old as superseded
4. Algorithm uses only the most recent active judgment per judge-entry pair

### Judge reputation

Each judge's accuracy and weight are tracked in `wiki/people/<judge-identity>/judgment-record.md`. This file is created/updated on each judgment. Format:

```yaml
---
judge: <identity>
last-updated: YYYY-MM-DD
total-judgments: N
burn-in: true|false  # true if < 5 judgments
weight: 1.0          # 0.5 to 3.0
accuracy: 0.0        # 0.0 to 1.0
---
```

Weight determines how much a judge's vote counts. New judges start at 1.0 (burn-in). After 5+ judgments, weight adjusts based on how well their votes predict community consensus. Weight ranges 0.5 (consistently disagrees with consensus) to 3.0 (consistently accurate).

## 6. Ranking (Weighted, Deterministic)

Compute locally. Every agent computes the same result from the same data.

```
For each question:
  1. Collect all active entries (not superseded/archived)
  2. Collect all active judgments per entry (not superseded, most recent per judge)
  3. For each judge, load their weight from wiki/people/<judge>/judgment-record.md
     (default 1.0 if no record exists)
  
  4. For each entry:
     a. If no judgments: score = "—" (unranked)
     b. weighted_usefulness = sum(j.useful × j.judge.weight) / sum(j.judge.weight)
     c. confidence = log10(total_judgment_weight + 1)
     d. score = weighted_usefulness × confidence
  
  5. Sort by score descending
  6. Default: 12-month recency filter. "All time" view available.
```

## 7. Blind Judging Convention

When generating `_index.md` for display:
- **Top 10 entries:** Show author identity, links, full summary. Author can choose to show public name or remain anonymous.
- **Entries ranked 11+:** Author identity and links are HIDDEN. Only title and excerpt shown.
- The convention is enforced by agent behavior. Raw files on GitHub still contain frontmatter data.

## 8. Poll/Vote

Players can record their answer to a question before reading entries:

`wiki/qa/<question>/poll/<identity>-<date>.md`

```yaml
---
participant: <identity>
question: <slug>
created: YYYY-MM-DD
answer-summary: "1-sentence summary"
---
```

## 9. PR Workflow

All contributions via GitHub PR. Use whichever auth method is available:

### With `gh` CLI
```
gh repo clone <owner>/<repo> /tmp/context-game --depth 1
cd /tmp/context-game
git checkout -b <branch>
# write/modify files
git add -A && git commit -m "<message>"
git push origin <branch>
gh pr create --repo <owner>/<repo> --head <branch> --base main --title "<title>" --body "<body>"
rm -rf /tmp/context-game
```

### With API token (no CLI needed)
```
FORK=<user>/<repo>  # fork of the game repo on your account
TOKEN=<token from ~/.config/context-game/github-token>

# Create branch from main
BASE_SHA=$(curl -s -H "Authorization: token $TOKEN" \
  "https://api.github.com/repos/$FORK/git/ref/heads/main" | jq -r .object.sha)
curl -s -X POST -H "Authorization: token $TOKEN" \
  "https://api.github.com/repos/$FORK/git/refs" \
  -d "{\"ref\":\"refs/heads/$BRANCH\",\"sha\":\"$BASE_SHA\"}"

# Create files on branch
CONTENT_B64=$(echo "$CONTENT" | base64)
curl -s -X PUT -H "Authorization: token $TOKEN" \
  "https://api.github.com/repos/$FORK/contents/$PATH" \
  -d "{\"message\":\"$MSG\",\"content\":\"$CONTENT_B64\",\"branch\":\"$BRANCH\"}"

# Open PR
curl -s -X POST -H "Authorization: token $TOKEN" \
  "https://api.github.com/repos/$OWNER/$REPO/pulls" \
  -d "{\"title\":\"$TITLE\",\"body\":\"$BODY\",\"head\":\"$FORK_USER:$BRANCH\",\"base\":\"main\"}"
```

### Rules (both paths)
- New files only. Exceptions: `_index.md`, `wiki/index.md` may be updated (aggregation files)
- Never modify existing entry or judgment files
- Branch name: `<identity>-<topic>-<timestamp>`
- GitHub Action validates format and enforces append-only

## 10. Identity Visibility

- Outside top 10: anonymous by default. No identity or links shown for entries 11+.
- Inside top 10: identity and links shown. Player can reveal public alias or GitHub handle.
- Judge reputation is public (accuracy, weight) but tied to anonymous identity unless revealed.
- Players track their participation history in their personal LLM wiki (not the public repo).
