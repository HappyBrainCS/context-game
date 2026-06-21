# Skill: Setup — First-Time Player Onboarding

## Trigger
Player says something like: "I want to play the Context Game" or gives you the repo URL.

## What You Need to End Up With

After setup, the player should have:
1. An anonymous identity at `~/.config/context-game/identity`
2. An optional profile at `~/.config/context-game/profile`
3. An optional GitHub token at `~/.config/context-game/github-token`
4. The game index fetched and cached for the session

## Step 1: Check Existing Setup

Check if these files exist (in order):
- `~/.config/context-game/identity`
- `~/.config/context-game/github-token`

If identity exists: Skip to Step 3. Player is already registered.
If token exists: Skip Step 2. Player already has write access.
If neither exists: Continue with full setup.

## Step 2: Generate Identity

Generate: `anon-<8 random hex characters>`
Example: `anon-a1b2c3d4`

Store it:
```
mkdir -p ~/.config/context-game
echo "anon-a1b2c3d4" > ~/.config/context-game/identity
```

## Step 3: Offer GitHub Token

Say: "To submit entries and make judgments, I need a GitHub classic personal access token with the `public_repo` scope. Without one, you can still browse all questions and read Top 10 answers. Want to set one up?"

If yes:
```
Here's exactly what to do:
1. Go to: https://github.com/settings/tokens
2. Click "Generate new token" → "Token (classic)"
3. Give it any name (e.g. "Context Game"), set an expiration
4. Under "Scopes", check the box labeled "public_repo" — that's it
5. Click "Generate token"
6. Copy the token and paste it here
```

**Important:** The `public_repo` scope is the only one needed. You do NOT need to select specific repos.

Store the token:
```
echo "ghp_xxxxx" > ~/.config/context-game/github-token
```

### Step 3b: Fork the Repo (First Time Only)

With the token stored, the player needs to fork the game repo. This gives them their own copy of the repo to write to.

**The agent handles this automatically.**

```http
POST /repos/HappyBrainCS/context-game/forks
Authorization: Bearer {TOKEN}
Content-Type: application/json

{
  "default_branch_only": true
}
```

Wait for the fork to complete (poll until `GET /repos/{player-username}/context-game` returns 200). Then store the fork owner:
```
echo "{player-username}" > ~/.config/context-game/fork-owner
```

The player doesn't need to do anything special — the fork happens in the background on GitHub's servers. No download, no local storage.

If no: The player is read-only. They can browse and read but can't submit. That's fine.

## Step 4: Offer Profile Setup

Say: "Your anonymous hash is `anon-a1b2c3d4`. Want to set up a profile? This is optional — you can skip or add it later."

Profile fields (all optional):
```
display_name: "Caleb"          # Shown if your entry makes Top 10
links: "https://youtube.com/@..., https://x.com/..."  # Shown if Top 10
location: "Cedar City, UT"     # Shown if Top 10, aggregated with 3+ others
```

Store:
```
cat > ~/.config/context-game/profile << 'EOF'
display_name: "Caleb"
links: ""
location: ""
EOF
```

## Step 5: Confirm

Say: "You're in. You are `anon-a1b2c3d4`. Ask me anything — I'll check the game for matching questions."

## Step 6: Fetch the Index

Fetch the game index and cache it for the session:

**For public repos (after launch):**
`https://raw.githubusercontent.com/HappyBrainCS/context-game/main/wiki/agent-index.json`

**For private repos (during testing):**
`GET https://api.github.com/repos/HappyBrainCS/context-game/contents/wiki/agent-index.json`
— Decode the base64 `content` field to get JSON.

## Edge Cases

| Situation | What to do |
|---|---|
| Identity file exists but is corrupt | Regenerate. Tell player: "Your identity file was corrupt, I regenerated it." |
| Token is invalid/expired | Say: "Your GitHub token doesn't work anymore. Want to generate a new one?" Repeat Step 3. |
| Player plays from a new device | Ask: "Your identity is stored locally. Want to use the same identity or create a new one?" |
| Agent can't write files | Derive identity deterministically from player's GitHub username. Say: "I'll derive your identity from your GitHub username." |
