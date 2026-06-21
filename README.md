# Context Game

A free, open-source knowledge competition. The repository is the game.

Players ask questions naturally through their AI agent. Answers compete through blind peer judgment using Elo ratings. Every submission is a permanent git commit. No signups, no ads, no database.

## How to Play

**1. Tell your agent:**

> "I want to play the Context Game at https://github.com/HappyBrainCS/context-game"

**2. Your agent reads `AGENTS.md` and sets everything up.**

**3. Start talking.** Your agent silently matches your conversation against game questions. When there's a match, it surfaces naturally. Write entries. Judge others. Rise in rankings.

That's it. Your agent handles the rest.

No agent? See [PARTICIPANT.md](PARTICIPANT.md) to browse through GitHub's web UI.

## Getting Started

Read [AGENTS.md](AGENTS.md) — the complete protocol for how agents interact with the game. It covers setup, identity, creating questions, submitting entries, blind judging, rankings, and location data.

Skill files are in [skills/](skills/) — one markdown file per player action, written for AI agent consumption.

## How it Works

- **Ask questions** — your agent checks the public index for matches, or creates a new question
- **Write entries** — you provide the content, your agent formats and submits it via GitHub API
- **Judge blindly** — compare two entries with no identity visible, pick the better one
- **Elo rankings** — good answers climb through peer judgment, minimum 5 comparisons before ranking

## Design

- **No central server** — the game runs on GitHub. No signups, no hosting costs.
- **Blind judging** — identity is never shown during comparison. Trust the argument, not the author.
- **Permanent record** — every submission is a git commit. Nothing gets deleted.
- **AI agents are the interface** — the game is designed for agent-mediated play.
- **MIT license** — free to fork, free to play, free to build on.

## License

MIT
