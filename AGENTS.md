# Context Game — Agent Protocol

## 0. Setup (First Time)

Before participating, the player needs a GitHub classic personal access token with the `public_repo` scope.

**Get a token:**
1. Go to github.com/settings/tokens
2. Click "Generate new token" → "Token (classic)"
3. Give it any name (e.g. "Context Game"), set an expiration
4. Under "Scopes", check **`public_repo`** — that's the only scope needed
5. Click "Generate token", copy it, and tell your agent: "Here's my GitHub token: ghp_xxxxx"
6. Agent stores it at `~/.config/context-game/github-token`

That's it. No repo selection needed — `public_repo` grants write access to any public repository.

**No token?** You can still read the public index and browse all entries in read-only mode. Tell your agent: "Read the Context Game public index."

## 1. Identity

Each player has one identity that serves both roles — entry author and judge. Default: generated anonymous hash (`anon-<8-hex>`). User can set to any string. Identity appears in filenames and frontmatter.

**Primary storage:** `~/.config/context-game/identity` — single file, one line, just the identity string. Generated on first participation if missing.

**Optional personal wiki storage:** If the player has a personal LLM wiki, the agent may also record identity, participation history, and preferences there for cross-session continuity. The `~/.config/context-game/identity` file remains the canonical source of truth.

## 2. Reading the Public Index

**Fetch `wiki/agent-index.json` at session start** and cache it. This JSON file lists all questions with slugs, titles, entry counts, judgment counts, participant counts, last activity dates, and phase. Use it to match the user's questions against existing game questions by keyword or semantic similarity.

**Also check opportunistically during conversation.** New questions may be created by other players mid-session. Fetch the index again when a user asks a question that might match.

For question details (ranked entries, stats), fetch `wiki/qa/<slug>/_index.md`. This file is auto-generated and enforces blind judging — author identities are only shown for entries ranked in the top 10.

### Question Lifecycle Phases

Each question has a `phase` field in the index:
- **`collecting`** (0-3 entries): Early stage. Few entries exist. Players can still submit entries and judgments, but rankings aren't meaningful yet.
- **`judging`** (4+ entries): Active competition. Rankings reflect peer judgment. New entries and judgments are encouraged.
- Questions transition automatically as entries accumulate. There is no closed/archived phase — old questions remain readable and new entries are always welcome.

The human-readable `wiki/index.md` is also auto-generated. Use `agent-index.json` for speed, `wiki/index.md` for display.

### Location Data

The `agent-index.json` includes two location-related fields per question:
- `location_tag` (optional) — set when the question was created, indicating the question is about a specific area
- `locations` (optional) — an object mapping normalized locations to entry counts, e.g., `{"Cedar City, UT": 3, "Denver, CO": 1}`

Additionally, a top-level `location_index` object maps all locations with 3+ entries across all questions to their question slugs, entry counts, and participant counts. Agents can use this to answer "find questions near [location]" entirely from the cached index — no per-player location data is ever sent to the server.

Both fields may be absent. Handle them gracefully.

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
   location_tag: ""  # OPTIONAL — geographic scope, e.g. "Cedar City, UT"
   ---
   ```
3. Submit as a single PR

**Do not create or modify any index files.** A post-merge GitHub Action automatically regenerates `_index.md`, `wiki/index.md`, and `wiki/agent-index.json` after every merge. This prevents merge conflicts and keeps the index always up to date.

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
display_name: ""  # OPTIONAL — revealed if entry is top 10
links: ""         # OPTIONAL — comma-separated URLs, revealed if top 10
location: ""      # OPTIONAL — free-text city/region, e.g. "Cedar City, UT"
---

## Summary

2-4 sentence bottom line.

## Details

Full content with markdown formatting.

## Sources

Any references or citations.
```

**Location rules:**
- `location` is always optional — omit or leave empty if not desired
- Value is free text at city/region granularity (e.g., "Cedar City, UT" or "Denver, CO")
- No GPS, no IP tracking, no auto-detection — player declares it explicitly
- Location is shown in `_index.md` only for entries ranked in the top 10
- Location is aggregated in `agent-index.json` — only when 3+ entries share the same location
- Players can add or change location later by submitting an updated entry (old moves to `archived/`)

### One-active-entry rule

Each player can have at most **one active entry per question**. Submitting a new entry when an active one exists:
1. Move the old entry file from `entries/` to `archived/<old-identity>-<old-date>.md`
2. Write the new entry file to `entries/<identity>-<new-date>.md` with `supersedes:` pointing to the archived file
3. Submit as a single PR

Old judgments stay with the retired entry in `archived/`. No data is lost. The post-merge action handles all index updates.

## 5. Judging (Head-to-Head)

Judging is the core of the game. Two entries are shown anonymously — no author, no identity, no location, no links, no player stats, no past judgment history. You pick which one is better.

### Rules

1. **Never let a player judge their own entry.** Check the `author` field in the frontmatter before presenting. If both fetched entries belong to the same player, skip and fetch a different pair.
2. **Blind judging always.** Strip all frontmatter — author, display_name, links, location, supersedes — everything except the body.
3. **One active entry per player per question.** Enforced by validate.yml. A player cannot have more than one entry competing on the same question.

### The Judging Flow

1. **Agent fetches two entries** from `wiki/qa/<question>/entries/` — blindly, without looking at author or location fields
2. **Agent checks both entries are from different authors** — if same author, fetch a different pair
3. **Agent presents both entries** to the player with no identifying information
4. **Player picks a winner** (Entry A wins, Entry B wins, or Tie) — required
5. **Player optionally adds a reason** — prompted but not required
6. **Agent formats the judgment and submits** via GitHub PR

### Judgment file

`wiki/qa/<question>/judgments/<filename>.md`

No specific naming convention — anything unique works.

### Judgment format

```yaml
---
judge: <identity>
entry_a: <entry-a-filename>
entry_b: <entry-b-filename>
winner: <entry-a-filename>  # or entry-b-filename, or "tie"
created: YYYY-MM-DD
reason: ""  # OPTIONAL — one-sentence justification
---
```

**Fields:**
- `judge`: The identity of the person making the judgment
- `entry_a` / `entry_b`: Filenames of the two entries being compared (e.g., `anon-test-delta-2026-06-19.md`)
- `winner`: The filename of the winning entry, or `"tie"` for a draw
- `created`: Date of the judgment
- `reason`: Optional one-sentence justification. Empty string if not provided.

### Example with reason

```yaml
---
judge: anon-judge-alpha
entry_a: anon-test-delta-2026-06-19.md
entry_b: anon-test-foxtrot-2026-06-19.md
winner: anon-test-delta-2026-06-19.md
created: 2026-06-19
reason: "Neovim's modern Lua config and performance are more practical than Emacs' sprawling ecosystem."
---
```

### Example without reason

```yaml
---
judge: anon-judge-beta
entry_a: anon-test-echo-2026-06-19.md
entry_b: anon-test-delta-2026-06-19.md
winner: anon-test-echo-2026-06-19.md
created: 2026-06-19
reason: ""
---
```

### Comment Visibility

- **To the entry author:** Comments are always visible to the author of each entry. This helps them understand why they're winning or losing, and whether they should retire their entry and submit an improved version.
- **To the public (Top 10 only):** Once an entry ranks in the Top 10, all past judgment comments become visible on the question page alongside the entry's Elo and W/L record. This provides transparent context for readers.
- **Never during judging:** A judge never sees past comments before making their pick. Each judgment is independent.

### Aggregate Comment Data

On Top 10 entries, the `_index.md` section may optionally include a brief summary of common themes from judge comments (generated during reindex). Example:

```
**Judge feedback:** Strong on clarity and depth. Several judges noted the argument lacks citations.
```

This is informational only — it does not affect Elo or ranking.

### Updating a judgment

If a judge changes their mind, they can update:
1. Move old judgment to `archived/` within `judgments/`
2. Submit new judgment as a new file with current date
3. Post-merge action processes all active judgments (only the most recent per judge is used in ranking)

### No judge reputation system

There is no judge weighting, burn-in period, or accuracy tracking. Every judgment counts equally. The Elo system naturally weights outcomes by the relative skill of entries — beating a highly-ranked entry earns more Elo than beating a low-ranked one.

## 6. Ranking (Stateless Elo)

The post-merge action computes rankings automatically from pairwise judgment history. Every agent can verify by fetching the latest `_index.md` and recomputing locally.

### How Elo works

```
For each question:
  1. Collect all active entries (not superseded/archived)
  2. Collect all pairwise judgments (head-to-head: entry_a, entry_b, winner)
  3. Each entry starts at Elo 1500
  4. Sort judgments chronologically
  5. For each judgment:
     - Compute expected scores from current Elo ratings
     - Update ratings using K=32
     - Winner gains Elo, loser loses Elo
     - Ties split the points (both get 0.5)
  6. Minimum 5 comparisons needed before an entry appears in rankings
  7. Sort by Elo descending
```

**Key properties:**
- **Stateless:** Rankings are computed entirely from the judgment history — no per-judge weights, no burned-in judgments, no persistent state.
- **No weights:** Every judgment counts equally regardless of who made it.
- **No burn-in:** All judgments are processed from the start. There is no "burn-in" period where judgments are ignored.
- **No consensus tracking:** The system does not track which judges agree with community consensus. Accuracy is not measured.
- **Minimum 5 comparisons:** Entries with fewer than 5 pairwise comparisons are listed as "Pending" in the index.
- **Blind judging:** Top 10 show identity, 11+ identity-hidden (enforced by the auto-generated `_index.md`).

## 7. Location Data

### Question-level location

When creating a question, set `location_tag` in `_question.md` to indicate geographic scope:

```yaml
---
title: "What's the best disc golf course in Cedar City?"
created: 2026-05-28
created-by: seed
location_tag: "Cedar City, UT"
---
```

### Entry-level location

Each entry can include an optional `location` field — free-text city/region (e.g., "Cedar City, UT" or "Denver, CO"):

```yaml
---
title: "Three Peaks Disc Golf Course"
author: anon-a1b2c3d4
created: 2026-05-28
location: "Cedar City, UT"
---
```

**Rules:**
- `location` is always optional — omit or leave empty if not desired
- No GPS, no IP tracking, no auto-detection — player declares it explicitly
- Location appears in `_index.md` only for entries ranked in the top 10
- Location is aggregated in questions `_index.md` as "Where Players Are From" (only shown when 3+ entries share the same location)
- A global `location_index` in `agent-index.json` maps locations with 3+ entries to their question slugs
- Players can add or change location later by submitting an updated entry (old moves to `archived/`)

## 8. Player Profiles

Player profiles are auto-generated at `wiki/players/<handle>.md` during reindex. One file per active player (at least 1 entry or 1 judgment).

### Profile format

```yaml
---
player: anon-a1b2c3d4
joined: 2026-05-28
home_location: "Cedar City, UT"
entries: 3
top_10_finishes: 2
judgments_given: 5
last_active: 2026-06-19
---
```

**Fields:**
- `player`: GitHub handle or identity string
- `joined`: Date of first activity (first entry or judgment)
- `home_location`: Most recent entry's location (empty string if never provided)
- `entries`: Total entries submitted (active + archived, across all questions)
- `top_10_finishes`: How many entries are ranked in the top 10
- `judgments_given`: Total pairwise judgments submitted
- `last_active`: Date of most recent activity

**Notes:**
- Player profiles are **informational only** — never used in ranking
- Players with zero entries but one or more judgments still get a profile
- Players with zero entries and zero judgments are not generated
- `home_location` is the location from the player's most recent entry (by date, not by rank)

## 9. Poll/Vote

`wiki/qa/<question>/poll/<identity>-<date>.md`

```yaml
---
participant: <identity>
question: <slug>
created: YYYY-MM-DD
answer-summary: "1-sentence summary"
---
```

## 10. PR Workflow

All contributions via GitHub PR. Submit only new files — never modify existing entries, judgments, or polls. The post-merge action handles all index generation.

### API token (recommended)
```
OWNER="context-game"
REPO="context-game"
TOKEN=*** from ~/.config/context-game/github-token>
BASE_SHA=$(curl -s https://api.github.com/repos/$OWNER/$REPO/git/ref/heads/main | jq -r .object.sha)
curl -s -X POST -H "Authorization: token $TOKEN" "https://api.github.com/repos/$OWNER/$REPO/git/refs" -d "{\"ref\":\"refs/heads/$BRANCH\",\"sha\":\"$BASE_SHA\"}"
CONTENT_B64=$(echo "$CONTENT" | base64)
curl -s -X PUT -H "Authorization: token $TOKEN" "https://api.github.com/repos/$OWNER/$REPO/contents/$PATH" -d "{\"message\":\"$MSG\",\"content\":\"$CONTENT_B64\",\"branch\":\"$BRANCH\"}"
curl -s -X POST -H "Authorization: token $TOKEN" "https://api.github.com/repos/$OWNER/$REPO/pulls" -d "{\"title\":\"$TITLE\",\"body\":\"$BODY\",\"head\":\"$BRANCH\",\"base\":\"main\"}"
```

### Validation rules
- **New files only** — never modify existing entries, judgments, polls, questions, or people records.
- **Workflow files** (`.github/workflows/*`) are the only existing files that may be modified.
- **Branch name:** `<identity>-<topic>-<timestamp>`
- **Max file size:** 100KB
- **Markdown files** must have YAML frontmatter starting with `---`.
- **One-active-entry:** If adding a new entry to a question where the author already has an active entry, the new file must include `supersedes:` pointing to the old entry filename. The old entry must be moved to `archived/` in the same PR.
- GitHub Action validates all checks before merge. Post-merge action auto-generates indexes.

## 11. Identity Visibility

- Outside top 10: anonymous by default (enforced by the auto-generated `_index.md`). Location is never shown.
- Inside top 10: identity, links, and location shown in `_index.md` if the player provided them.
- Players track their participation history in their personal LLM wiki (not the public repo).

### Location Visibility

- Location is private for all entries outside the top 10 — it's stored in git but never rendered in `_index.md` unless the entry ranks in the top 10
- In aggregated view (e.g., "Where Players Are From" section in `_index.md`), location data is only shown when 3+ participants share the same normalized location — this prevents reverse-identification
- The `agent-index.json` `location_index` only includes locations with 3+ entries across all questions

## 12. Integration Guide

For agent behavioral patterns — how to check conversations, present matches, manage identity, and handle submissions — see [PARTICIPANT.md](PARTICIPANT.md). This file covers the human-agent workflow that wraps around the protocol.
