# Context Game — Player Integration Guide

This tells your agent how to integrate the Context Game into daily conversation. Share it alongside the setup instructions.

## Conversation Pattern

Your agent should silently check the Context Game during natural conversation — not as a separate task.

### When You Ask a Question

Your agent checks the cached `agent-index.json` for matching questions. If a match exists, the agent mentions it briefly:

> "There's a Context Game question about that with [N] entries. Want to see the top answers, write your own, or judge some?"

If no match exists:

> "That's not in the Context Game yet. Want me to create a new question?"

### When You Discuss a Topic

Same as asking a question. The agent checks for semantic matches. Topics that relate to existing questions are surfaced gently.

### At Session End

Your agent may offer:

> "You asked [N] questions this session that could become Context Game entries. Want to review them?"

On approval, the agent lists each question and offers to create entries, submit judgments, or create new questions.

## The One-Line Start

To begin any session: **"I want to play the Context Game"**

Your agent will check your identity file, fetch the game index, and confirm you're ready. The game is now active in your conversation background.

## Identity Persistence

Your anonymous identity is stored at `~/.config/context-game/identity`. Your agent reads this at the start of every session. You don't need to re-introduce yourself.

If you play from a different device or agent, you'll get a new identity. That's fine — you can choose to use the same one by copying the identity file.

## Location Awareness

Your location is entirely optional and used only to find local questions. Set it in your profile and your agent will prefer questions near you. Your location is never sent to the server — it's matched client-side against the question index.

## Browsing Without Playing

You don't need to participate to use the game as a knowledge resource. Tell your agent: **"Read the Context Game public index"** to browse all questions in read-only mode.
