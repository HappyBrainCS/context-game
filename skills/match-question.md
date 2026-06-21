# Skill: Match Question — Find the Right Question for a Player's Query

## Trigger
Player asks a question or talks about a topic. Check the game index for matching questions.

## What You Have

The cached `agent-index.json`. Treat this like an LLM wiki index: you scan it to find the right page, then navigate there.

Each question object:
```json
{
  "slug": "whats-the-best-disc-golf-course",
  "title": "What's the best disc golf course in Cedar City?",
  "keywords": ["disc golf", "Cedar City", "course", "frisbee golf"],
  "entry_count": 5,
  "judgment_count": 12,
  "participant_count": 4,
  "last_activity": "2026-06-20",
  "phase": "judging",
  "location_tag": "Cedar City, UT"
}
```

## Step 1: Scan the Index (LLM Wiki Pattern)

Read the player's query. Then scan the index's `title` and `keywords` for each question. This is not fuzzy string matching — you're an LLM, you understand meaning. But follow a structured decision tree:

### Decision Tree

**Does the query directly match a question title or keyword?**
→ Yes: That's an exact match. Go to Step 2a.
→ No: Continue.

**Does the query clearly express the same intent as an existing question, just with different words?**
→ "What's the best way to learn Spanish?" matches "What's the best method for learning a new language?" — same intent, different words. That's a semantic match. Go to Step 2a.
→ No: Continue.

**Does the query contain keywords that overlap with multiple questions?**
→ "What's a good disc golf course in St. George?" overlaps with "What's the best disc golf course in Cedar City?" (disc golf, course). That's a partial match. Go to Step 2b.
→ No: Continue.

**Does the query mention a topic that no existing question covers?**
→ Player asks "How do I contribute to open source?" and no question exists about open source. That's no match. Go to Step 2c.

### Guardrails (Don't Do These)

- **Don't match based on single common words.** "best" appears in half the questions. Don't match "best pizza" to "best disc golf course" just because both have "best."
- **Don't match on topic alone if the specific question is different.** "What's the best text editor?" is not a match for "What makes a good wiki entry?" even though both involve writing.
- **When in doubt, offer multiple options.** If you're 50/50 on whether something matches, treat it as a partial match and let the player decide.

## Step 2a: Exact or Strong Match

The player's query clearly matches a specific question.

Say: "There's a Context Game question about that: **[Question Title]** — with [N] entries and [M] judges."

Then offer: "Want to see the top answers, write your own, or judge some entries?"
- "Show the top answers" → `skills/view-rankings.md`
- "Write my own" → `skills/submit-entry.md`
- "Judge some" → `skills/judge-entries.md`

Also mention location if applicable. If the question has a `location_tag` and the player mentioned a location, note the connection.

## Step 2b: Multiple Partial Matches

The player's query could match several questions, but none is a clear winner.

Say: "There are a few related questions in the game:"
1. "[Question A]" — [N] entries, [M] judges
2. "[Question B]" — [N] entries, [M] judges
3. "[Question C]" — [N] entries, [M] judges

"Which one fits best? Or would you like to create a new question?"

If the player's query is close but not quite right, also offer: "Or I could create a new question more specific to what you're asking."

## Step 2c: No Match

The player's query doesn't match any existing question.

Say: "There's no Context Game question about that yet. Want me to create one? You'll get credit as the first asker."

If yes → `skills/create-question.md`

If the player declines, note the topic. At session end, offer: "You asked about [topic] earlier — still want to create a Context Game question for it?"

## Step 3: Location-Aware Matching

If the player's question mentions a location, check:
1. The question's `location_tag` field (if the question itself is about a place)
2. The question's `locations` map (where players are from who answered)
3. The player's known location from their profile

Prefer questions near the player or near the location they mentioned.

Example: Player in Cedar City asks "Best disc golf in St. George?" — the index has a disc golf question with `location_tag: "Cedar City, UT"` and players from Cedar City and St. George. That's relevant. Mention: "There's a related question about disc golf near there. St. George is close."

## Step 4: Re-Fetch the Index

If the player's query doesn't match and you haven't fetched the index recently, re-fetch it. New questions may have been created since session start. One re-fetch per conversation block is enough.

## Step 5: Present the Question Page

Once the player chooses a question, fetch and display the question page:
→ `skills/view-rankings.md`
