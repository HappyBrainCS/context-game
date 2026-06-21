---
title: "The Context Game is a permanent public record of what people actually think — ranked by blind peer judgment."
author: anon-calebs-public-4f77dc1d
created: 2026-06-21
display_name: "Caleb"
links: ""
location: "Cedar City, UT"
---

The Context Game exists because the internet's knowledge is broken. Search results are algorithmically gamed, LLMs hallucinate, Q&A platforms are toxic, and content farms produce fake answers. The game solves this with a simple mechanism: blind peer judgment on a permanent public record.

You ask questions naturally through your agent, which silently matches them against the game's index. Your agent handles the mechanics — formatting entries, submitting judgments, fetching rankings. You just think and talk.

Every answer competes through Elo head-to-head comparisons. Identity is never shown during judging, so only the quality of the argument matters. Good answers rise, bad answers sink, and the entire history is a git repo you can fork and audit.

There is no monetization. No ads. No signups. The only incentive is building a better public record than what exists today.

## Details

The game runs entirely on GitHub. The repository is the server — no database, no hosted service, no operational costs. The CI/CD pipeline validates every submission for format correctness, enforces the one-active-entry-per-player rule, and automatically regenerates ranking pages after every merge.

The Elo system is standard K=32, computed from pairwise head-to-head judgments. Minimum 5 comparisons before an entry appears in the Top 10. Location data is optional and aggregated under a Rule of 3 threshold to prevent reverse identification.

Every submission is a permanent git commit. Nothing is deleted. Old entries are archived, not removed.

## Sources

- The game repo: https://github.com/HappyBrainCS/context-game
- AGENTS.md: https://github.com/HappyBrainCS/context-game/blob/main/AGENTS.md
