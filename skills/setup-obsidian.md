# Skill: Setup Obsidian — Read Question Pages and Entries

## Trigger
Player wants to read a question page or entry in Obsidian rather than in chat.

## What This Does

Obsidian gives players a clean, formatted view of question pages (stats, rankings, entries) and individual entries. No token cost to browse — the content is local.

## Step 1: One-Time Setup

**Clone the repo** (if not already done):

```bash
cd ~/Documents/
git clone https://github.com/HappyBrainCS/context-game.git "ContextGame"
```

**Add as an Obsidian vault:**
1. In Obsidian, click "Open folder as vault"
2. Navigate to `~/Documents/ContextGame/wiki/`
3. Click "Open"

The vault is now set up. The player only needs to do this once.

## Step 2: Reading a Question Page

The question page is at `wiki/questions/<slug>.md`. The agent copies just that one file to a clean location and opens it:

```bash
cp ~/Documents/ContextGame/wiki/questions/<slug>.md ~/Documents/ContextGame/
open "obsidian://open?vault=ContextGame&file=<slug>"
```

The player sees: title, stats (entries, judgments, participants), Top 10 rankings with Elo and author info, location aggregation, poll answers.

## Step 3: Reading an Entry

The entry file is at `wiki/qa/<slug>/entries/<filename>.md`. The agent copies just that one file and opens it:

```bash
cp ~/Documents/ContextGame/wiki/qa/<slug>/entries/<filename>.md ~/Documents/ContextGame/
open "obsidian://open?vault=ContextGame&file=<filename-without-.md>"
```

The player sees: full entry content with frontmatter (author, display_name, links, location if opted in).

## Step 4: Judging Two Entries

For head-to-head judging, the agent copies both entry files to the vault:

```bash
cp ~/Documents/ContextGame/wiki/qa/<slug>/entries/<entry-a>.md ~/Documents/ContextGame/
cp ~/Documents/ContextGame/wiki/qa/<slug>/entries/<entry-b>.md ~/Documents/ContextGame/
```

Tell the player: "Entry A and Entry B are open in Obsidian. Compare them and tell me which one is better."

The player can switch between the two tabs in Obsidian to compare.

## Step 5: Keeping the Vault Clean

After the player finishes reading, the agent removes the temporary files:

```bash
rm ~/Documents/ContextGame/*.md
```

(Keeps only the .obsidian/ config directory, not the markdown files.)

## When Reading in Chat Instead

If the player doesn't have Obsidian or doesn't want to use it, the agent reads the question page or entry content aloud in chat. The content is the same either way — Obsidian just gives a nicer visual experience for longer reading.

## Edge Cases

| Situation | What to do |
|---|---|
| Repo not cloned yet | Clone it: `git clone https://github.com/HappyBrainCS/context-game.git ~/Documents/ContextGame` |
| Player reads multiple entries | Copy one at a time. Clean up after each. |
| Need to sync latest data | Run `cd ~/Documents/ContextGame && git pull` |
