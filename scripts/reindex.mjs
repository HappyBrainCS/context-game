import { readdirSync, readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const QA_DIR = join(ROOT, 'wiki/qa');
const GAME_REPO = process.env.GAME_REPO || 'HappyBrainCS/context-game';
const GAME_REPO_URL = `https://github.com/${GAME_REPO}`;
const MIN_COMPARISONS = 5;
const MIN_LOCATION_PARTICIPANTS = 3; // Minimum 3 participants with same location to show aggregated data
const MIN_LOCATION_INDEX_PARTICIPANTS = 3; // Minimum total entries for a location to appear in the global location_index
const ELO_K = 32;
const ELO_START = 1500;

// --- Helpers ---

function readYamlHead(filePath) {
  const text = readFileSync(filePath, 'utf-8');
  const parts = text.split('---\n');
  if (parts.length < 3) return {};
  const yamlText = parts[1];
  const fields = {};
  for (const line of yamlText.split('\n')) {
    const match = line.match(/^(\w[\w-]*):\s*(.+)$/);
    if (match) fields[match[1]] = match[2].replace(/^["']|["']$/g, '').trim();
  }
  return fields;
}

/**
 * Normalize a location string for grouping.
 * Trims whitespace and lowercases for matching.
 * Returns the original string (capitalized) for display.
 */
function normalizeLocation(loc) {
  if (!loc || !loc.trim()) return null;
  const trimmed = loc.trim();
  // Return both the raw value for display and a normalized key for grouping
  return {
    display: trimmed,
    key: trimmed.toLowerCase()
  };
}

/**
 * Capitalize first letter of each word for display consistency.
 */
function capitalizeDisplay(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Build location aggregation for a set of entries.
 * Returns an object: { displayLoc -> count } only for locations meeting the threshold.
 */
function buildLocationAggregation(entries, minThreshold = MIN_LOCATION_PARTICIPANTS) {
  const countMap = {}; // key -> { display: string, count: number }
  
  for (const entry of entries) {
    if (!entry.location) continue;
    const normalized = normalizeLocation(entry.location);
    if (!normalized) continue;
    
    if (!countMap[normalized.key]) {
      countMap[normalized.key] = { display: normalized.display, count: 0 };
    }
    countMap[normalized.key].count++;
  }
  
  // Filter by threshold and build result
  const result = {};
  for (const [key, data] of Object.entries(countMap)) {
    if (data.count >= minThreshold) {
      result[capitalizeDisplay(data.display)] = data.count;
    }
  }
  
  return result;
}

/**
 * Build a global location index across all questions.
 * Returns: { displayLoc -> { question_count, entry_count, participant_count, questions: [slug] } }
 * Only includes locations meeting the global threshold.
 */
function buildLocationIndex(questions, minEntries = MIN_LOCATION_INDEX_PARTICIPANTS) {
  const globalLocations = {}; // key -> { display, entryCount, participantCount, questions: Set }
  
  for (const q of questions) {
    // Collect unique participants per location for this question
    const locParticipants = {}; // locationKey -> Set of author identities
    
    for (const entry of q.entryRankings) {
      if (!entry.location) continue;
      const normalized = normalizeLocation(entry.location);
      if (!normalized) continue;
      
      if (!locParticipants[normalized.key]) {
        locParticipants[normalized.key] = { display: normalized.display, participants: new Set() };
      }
      locParticipants[normalized.key].participants.add(entry.author);
    }
    
    // Merge into global index
    for (const [locKey, data] of Object.entries(locParticipants)) {
      if (!globalLocations[locKey]) {
        globalLocations[locKey] = {
          display: data.display,
          entryCount: 0,
          participantCount: 0,
          questions: new Set()
        };
      }
      
      // Count entries from this location in this question
      const entryCount = q.entryRankings.filter(e => {
        const eLoc = normalizeLocation(e.location);
        return eLoc && eLoc.key === locKey;
      }).length;
      
      globalLocations[locKey].entryCount += entryCount;
      globalLocations[locKey].participantCount += data.participants.size;
      globalLocations[locKey].questions.add(q.slug);
    }
  }
  
  // Filter by threshold and build final object
  const result = {};
  for (const [key, data] of Object.entries(globalLocations)) {
    if (data.entryCount >= minEntries) {
      result[capitalizeDisplay(data.display)] = {
        question_count: data.questions.size,
        entry_count: data.entryCount,
        participant_count: data.participantCount,
        questions: [...data.questions]
      };
    }
  }
  
  return result;
}

/**
 * Compute Elo ratings for all entries given a sequence of pairwise judgments.
 * Processes judgments in chronological order.
 * Returns a map: filename -> { elo, comparisonCount, wins, losses, ties }
 */
function computeEloRatings(entryFilenames, judgments) {
  const stats = {};
  for (const fname of entryFilenames) {
    stats[fname] = { elo: ELO_START, comparisonCount: 0, wins: 0, losses: 0, ties: 0 };
  }

  // Sort judgments chronologically
  const sorted = [...judgments].sort((a, b) => a.created.localeCompare(b.created));

  for (const j of sorted) {
    const statA = stats[j.entry_a];
    const statB = stats[j.entry_b];
    if (!statA || !statB) continue; // skip judgments referencing unknown entries

    const ratingA = statA.elo;
    const ratingB = statB.elo;

    const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
    const expectedB = 1 / (1 + Math.pow(10, (ratingA - ratingB) / 400));

    let scoreA, scoreB;

    if (j.winner === j.entry_a) {
      scoreA = 1; scoreB = 0;
      statA.wins++; statB.losses++;
    } else if (j.winner === j.entry_b) {
      scoreA = 0; scoreB = 1;
      statA.losses++; statB.wins++;
    } else if (j.winner === 'tie') {
      scoreA = 0.5; scoreB = 0.5;
      statA.ties++; statB.ties++;
    } else {
      continue; // invalid judgment — skip
    }

    statA.elo = Math.round((ratingA + ELO_K * (scoreA - expectedA)) * 10) / 10;
    statB.elo = Math.round((ratingB + ELO_K * (scoreB - expectedB)) * 10) / 10;
    statA.comparisonCount++;
    statB.comparisonCount++;
  }

  return stats;
}

// --- Main ---

const questions = [];

if (!existsSync(QA_DIR)) {
  console.log('No wiki/qa/ directory found.');
  process.exit(0);
}

const qDirs = readdirSync(QA_DIR).filter(d => {
  const fullPath = join(QA_DIR, d);
  return statSync(fullPath).isDirectory() && d !== '.gitkeep';
});

for (const slug of qDirs) {
  const qDir = join(QA_DIR, slug);
  const questionMd = join(qDir, '_question.md');
  if (!existsSync(questionMd)) continue;

  const qMeta = readYamlHead(questionMd);
  const title = qMeta.title || slug;
  const createdBy = qMeta['created-by'] || 'unknown';
  const locationTag = qMeta['location_tag'] || '';

  // Active entries
  const entriesDir = join(qDir, 'entries');
  const activeEntries = [];
  if (existsSync(entriesDir)) {
    const files = readdirSync(entriesDir).filter(f => f.endsWith('.md') && f !== '.gitkeep');
    for (const file of files) {
      const meta = readYamlHead(join(entriesDir, file));
      activeEntries.push({
        filename: file,
        author: meta.author || 'unknown',
        title: meta.title || '',
        created: meta.created || '',
        links: meta.links || '',
        display_name: meta.display_name || '',
        location: meta.location || ''  // OPTIONAL — free-text city/region
      });
    }
  }

  // Archived count
  const archivedDir = join(qDir, 'archived');
  const archivedCount = existsSync(archivedDir)
    ? readdirSync(archivedDir).filter(f => f.endsWith('.md') && f !== '.gitkeep').length
    : 0;

  // Judgments (head-to-head pairwise format)
  const judgmentsDir = join(qDir, 'judgments');
  const judgments = [];
  if (existsSync(judgmentsDir)) {
    for (const file of readdirSync(judgmentsDir).filter(f => f.endsWith('.md') && f !== '.gitkeep')) {
      const meta = readYamlHead(join(judgmentsDir, file));
      // Accept both old format (entry/useful) and new format (entry_a/entry_b/winner)
      if (meta.entry_a && meta.entry_b && meta.winner) {
        judgments.push({
          judge: meta.judge || '',
          entry_a: meta.entry_a,
          entry_b: meta.entry_b,
          winner: meta.winner,
          created: meta.created || '',
          reason: meta.reason || ''
        });
      } else if (meta.entry && meta.useful) {
        // Legacy judgment format — convert to a pseudo-pairwise for compatibility
        judgments.push({
          judge: meta.judge || '',
          entry_a: meta.entry,
          entry_b: '__legacy__',
          winner: '__legacy__',
          created: meta.created || '',
          isLegacy: true
        });
      }
    }
  }

  // Poll data
  const pollDir = join(qDir, 'poll');
  const pollEntries = [];
  if (existsSync(pollDir)) {
    for (const file of readdirSync(pollDir).filter(f => f.endsWith('.md') && f !== '.gitkeep')) {
      const meta = readYamlHead(join(pollDir, file));
      pollEntries.push({
        participant: meta.participant || '',
        answer: meta['answer-summary'] || ''
      });
    }
  }

  // Separate pairwise judgments from legacy ones
  const pairwiseJudgments = judgments.filter(j => !j.isLegacy);
  const legacyJudgments = judgments.filter(j => j.isLegacy);

  // Compute Elo ratings from pairwise judgments
  const entryFilenames = activeEntries.map(e => e.filename);
  const eloStats = computeEloRatings(entryFilenames, pairwiseJudgments);

  // Build entry rankings
  const entryRankings = activeEntries.map(entry => {
    const s = eloStats[entry.filename] || { elo: ELO_START, comparisonCount: 0, wins: 0, losses: 0, ties: 0 };
    return {
      ...entry,
      elo: s.elo,
      comparisonCount: s.comparisonCount,
      wins: s.wins,
      losses: s.losses,
      ties: s.ties,
      judgmentCount: s.comparisonCount
    };
  });

  // Sort by Elo descending; entries with no comparisons sort last
  entryRankings.sort((a, b) => {
    if (a.comparisonCount === 0 && b.comparisonCount === 0) return 0;
    if (a.comparisonCount === 0) return 1;
    if (b.comparisonCount === 0) return -1;
    return b.elo - a.elo;
  });

  // Determine last activity
  let lastActivity = qMeta.created || '';
  for (const dirPath of [entriesDir, judgmentsDir, pollDir]) {
    if (!existsSync(dirPath)) continue;
    for (const f of readdirSync(dirPath).filter(f => f.endsWith('.md') && f !== '.gitkeep')) {
      const meta = readYamlHead(join(dirPath, f));
      if (meta.created && meta.created > lastActivity) lastActivity = meta.created;
    }
  }

  const revealedAuthors = entryRankings.filter((e, i) => i < 10 && e.display_name).length;
  
  // Build location aggregation for this question
  const locationAggregation = buildLocationAggregation(entryRankings);
  const locationCountMap = {};
  for (const entry of entryRankings) {
    if (entry.location) {
      const normalized = normalizeLocation(entry.location);
      if (normalized) {
        const key = capitalizeDisplay(normalized.display);
        locationCountMap[key] = (locationCountMap[key] || 0) + 1;
      }
    }
  }

  questions.push({
    slug, title, createdBy, lastActivity,
    entryCount: activeEntries.length, archivedCount, judgmentCount: judgments.length,
    pairwiseJudgmentCount: pairwiseJudgments.length,
    participantCount: new Set([
      ...activeEntries.map(e => e.author),
      ...judgments.map(j => j.judge)
    ]).size,
    phase: activeEntries.length < 4 ? 'collecting' : 'judging',
    entryRankings, pollEntries,
    revealedAuthors,
    minimumComparisons: MIN_COMPARISONS,
    locationTag,
    locationAggregation,
    locationCountMap
  });
}

questions.sort((a, b) =>
  b.lastActivity.localeCompare(a.lastActivity) || b.entryCount - a.entryCount
);

// ─── Generate wiki/questions/<slug>.md for each question ───
const QUESTIONS_DIR = join(ROOT, 'wiki/questions');
if (!existsSync(QUESTIONS_DIR)) {
  mkdirSync(QUESTIONS_DIR, { recursive: true });
}

for (const q of questions) {
  const qDir = join(QA_DIR, q.slug);
  
  // Build the page content
  let md = `# ${q.title}\n\n`;
  
  // Title line with creator and last activity
  md += `*Question created by ${q.createdBy} · Last activity: ${q.lastActivity}*\n\n`;
  
  // Stats line
  let statsParts = [`${q.participantCount} participant${q.participantCount === 1 ? '' : 's'}`];
  statsParts.push(`${q.entryCount} active entr${q.entryCount === 1 ? 'y' : 'ies'}`);
  statsParts.push(`${q.pairwiseJudgmentCount} comparison${q.pairwiseJudgmentCount === 1 ? '' : 's'}`);
  statsParts.push(`Phase: ${q.phase}`);
  md += `**Stats:** ${statsParts.join(' · ')}`;
  md += '\n\n';

  // Poll / What People Think section  —  group similar answers and show counts
  if (q.pollEntries.length > 0) {
    // Group by answer text
    const answerGroups = {};
    const answerOrder = [];
    for (const p of q.pollEntries) {
      const key = p.answer.trim().toLowerCase();
      if (!answerGroups[key]) {
        answerGroups[key] = { answer: p.answer, participants: [] };
        answerOrder.push(key);
      }
      answerGroups[key].participants.push(p.participant);
    }
    md += `### What Players Think (${q.pollEntries.length} entr${q.pollEntries.length === 1 ? 'y' : 'ies'})\n\n`;
    for (const key of answerOrder) {
      const g = answerGroups[key];
      const people = g.participants.map(p => `\`${p}\``).join(', ');
      const countSuffix = g.participants.length > 1 ? ` (*${g.participants.length} similar*)` : '';
      md += `- "${g.answer}" — ${people}${countSuffix}\n`;
    }
    md += '\n';
  }

  // Location aggregation section (only if threshold met: 3+ from same location)
  const locationKeys = Object.keys(q.locationAggregation);
  if (locationKeys.length > 0) {
    md += `### Where Players Are From\n\n`;
    // Only show locations meeting the threshold (already filtered by buildLocationAggregation)
    for (const loc of locationKeys.sort()) {
      md += `- **${loc}:** ${q.locationAggregation[loc]} entr${q.locationAggregation[loc] === 1 ? 'y' : 'ies'}\n`;
    }
    md += '\n';
  }

  const ranked = q.entryRankings.filter(e => e.comparisonCount >= q.minimumComparisons);
  const pending = q.entryRankings.filter(e => e.comparisonCount > 0 && e.comparisonCount < q.minimumComparisons);
  const unjudged = q.entryRankings.filter(e => e.comparisonCount === 0);

  // ── Top 10 ──
  if (ranked.length > 0) {
    md += `## Top 10\n\n`;
    const top10 = ranked.slice(0, 10);
    for (let rank = 0; rank < top10.length; rank++) {
      const e = top10[rank];
      const record = `${e.wins}W-${e.losses}L${e.ties > 0 ? `-${e.ties}T` : ''}`;

      md += `### #${rank + 1} — ${e.title}\n`;
      md += `_Elo ${e.elo.toFixed(1)} · ${e.comparisonCount} comps (${record})_\n`;

      if (e.display_name) {
        // Revealed author — show full detail
        md += `\nby **${e.display_name}** · [player profile](../players/${e.author}.md)`;
        if (e.location) {
          md += ` · Location: ${e.location}`;
        }
        md += '\n';
        if (e.links) {
          const linkItems = e.links.split(',').map(l => l.trim()).filter(Boolean);
          for (const link of linkItems) {
            md += `- <${link}>\n`;
          }
        }
      } else {
        // Anonymous — just show author hash on separate line
        md += `\n_${e.author}_\n`;
      }

      md += `- [Read full entry](../qa/${q.slug}/entries/${e.filename})\n\n`;
    }
  }

  // ── Pending entries (have comparisons but < minimum) ──
  if (pending.length > 0) {
    md += `## Pending (Need ${q.minimumComparisons}+ Comparisons)\n\n`;
    for (const e of pending) {
      const needed = q.minimumComparisons - e.comparisonCount;
      const record = `${e.wins}W-${e.losses}L${e.ties > 0 ? `-${e.ties}T` : ''}`;
      md += `### ${e.title}\n`;
      md += `_Elo ${e.elo.toFixed(1)} · ${e.comparisonCount} comps (${record}) — needs ${needed} more_\n`;
      md += `- [Read full entry](../qa/${q.slug}/entries/${e.filename})\n\n`;
    }
  }

  // ── Unjudged entries (0 comparisons) ──
  if (unjudged.length > 0) {
    md += `## Unjudged (No Comparisons Yet)\n\n`;
    for (const e of unjudged) {
      md += `- **${e.title}** — _by ${e.author}_`;
      if (e.location) {
        md += ` · ${e.location}`;
      }
      md += ` — [Read full entry](../qa/${q.slug}/entries/${e.filename})\n`;
    }
    md += '\n';
  }

  // ── Footer ──
  md += `---\n`;
  md += `*Elo ratings calculated from head-to-head pairwise comparisons. Entries need ${q.minimumComparisons}+ comparisons before appearing in Top 10. [Learn to play →](${GAME_REPO_URL}/blob/main/AGENTS.md)*\n`;
  
  writeFileSync(join(QUESTIONS_DIR, `${q.slug}.md`), md, 'utf-8');
}

// ─── Generate wiki/index.md ───
let indexMd = `# Context Game — Questions\n\n`;
indexMd += `| Question | Entries | Comparisons | Last Activity |\n`;
indexMd += `|---|---|---|---|\n`;
for (const q of questions) {
  indexMd += `| [${q.title}](questions/${q.slug}.md) | ${q.entryCount} | ${q.pairwiseJudgmentCount} | ${q.lastActivity || '—'} |\n`;
}
writeFileSync(join(ROOT, 'wiki/index.md'), indexMd, 'utf-8');

// ─── Generate wiki/players/<handle>.md ───

// Build player profiles by collecting data across all entries and judgments.
const playerData = {}; // handle -> { joined, home_location, entries, top_10_finishes, judgments_given, last_active }

function ensurePlayer(handle) {
  if (!playerData[handle]) {
    playerData[handle] = {
      joined: '',
      home_location: '',
      entries: 0,
      top_10_finishes: 0,
      judgments_given: 0,
      last_active: ''
    };
  }
  return playerData[handle];
}

function updateDate(player, date) {
  if (!date) return;
  if (!player.joined || date < player.joined) player.joined = date;
  if (date > player.last_active) player.last_active = date;
}

// Iterate all entries across all questions
for (const q of questions) {
  for (const entry of q.entryRankings) {
    const player = ensurePlayer(entry.author);
    player.entries++;
    
    // Check if this entry was in top 10 (ranked within top 10)
    const rankIndex = q.entryRankings.indexOf(entry);
    if (rankIndex >= 0 && rankIndex < 10) {
      player.top_10_finishes++;
    }
    
    // Track location — use most recent entry's location
    // Entries are sorted by Elo desc, but we need date-order for location
    // We'll track per-entry and update later via date comparison
    if (!player._entries) player._entries = [];
    player._entries.push({
      created: entry.created || '',
      location: entry.location || ''
    });
    
    // Update joined/last_active from entry created date
    updateDate(player, entry.created);
  }
}

// Also collect from legacy entries that might be in archived directories
for (const q of questions) {
  const qDir = join(QA_DIR, q.slug);
  const archivedDir = join(qDir, 'archived');
  if (existsSync(archivedDir)) {
    for (const f of readdirSync(archivedDir).filter(f => f.endsWith('.md') && f !== '.gitkeep')) {
      const meta = readYamlHead(join(archivedDir, f));
      if (meta.author) {
        const player = ensurePlayer(meta.author);
        player.entries++;
        if (!player._entries) player._entries = [];
        player._entries.push({
          created: meta.created || '',
          location: meta.location || ''
        });
        updateDate(player, meta.created);
      }
    }
  }
}

// Collect judgments
for (const q of questions) {
  const judgmentsDir = join(QA_DIR, q.slug, 'judgments');
  if (existsSync(judgmentsDir)) {
    for (const f of readdirSync(judgmentsDir).filter(f => f.endsWith('.md') && f !== '.gitkeep')) {
      const meta = readYamlHead(join(judgmentsDir, f));
      if (meta.judge) {
        const player = ensurePlayer(meta.judge);
        player.judgments_given++;
        updateDate(player, meta.created);
      }
    }
  }
}

// Resolve home_location: most recent entry's location
for (const handle of Object.keys(playerData)) {
  const player = playerData[handle];
  if (player._entries && player._entries.length > 0) {
    // Sort by created date descending to find most recent
    player._entries.sort((a, b) => {
      if (!a.created && !b.created) return 0;
      if (!a.created) return 1;
      if (!b.created) return -1;
      return b.created.localeCompare(a.created);
    });
    player.home_location = player._entries[0].location || '';
  }
  delete player._entries; // cleanup internal tracking
}

// Write player profiles
const PLAYERS_DIR = join(ROOT, 'wiki/players');
if (!existsSync(PLAYERS_DIR)) {
  mkdirSync(PLAYERS_DIR, { recursive: true });
}

// Sort alphabetically for deterministic output
const sortedHandles = Object.keys(playerData).sort();

for (const handle of sortedHandles) {
  const player = playerData[handle];
  // Only write files for active players (at least 1 entry OR 1 judgment)
  if (player.entries === 0 && player.judgments_given === 0) continue;
  
  let md = '---\n';
  md += `player: ${handle}\n`;
  md += `joined: ${player.joined || ''}\n`;
  md += `home_location: "${player.home_location}"\n`;
  md += `entries: ${player.entries}\n`;
  md += `top_10_finishes: ${player.top_10_finishes}\n`;
  md += `judgments_given: ${player.judgments_given}\n`;
  md += `last_active: ${player.last_active || ''}\n`;
  md += '---\n';
  
  writeFileSync(join(PLAYERS_DIR, `${handle}.md`), md, 'utf-8');
}

console.log(`Generated ${Object.keys(playerData).length} player profiles`);

// ─── Generate wiki/agent-index.json ───
// Build global location index across all questions
const locationIndex = buildLocationIndex(questions);

const agentIndex = {
  game: 'Context Game',
  repo: GAME_REPO,
  updated: new Date().toISOString().split('T')[0],
  agent_protocol: `${GAME_REPO_URL}/blob/main/AGENTS.md`,
  judging_system: 'head-to-head-elo',
  minimum_comparisons: MIN_COMPARISONS,
  questions: questions.map(q => {
    const qEntry = {
      slug: q.slug,
      title: q.title,
      entry_count: q.entryCount,
      judgment_count: q.pairwiseJudgmentCount,
      participant_count: q.participantCount,
      last_activity: q.lastActivity,
      ask_credit: q.createdBy,
      phase: q.phase,
      revealed_authors: q.revealedAuthors
    };
    
    // Add optional location_tag if set at question level
    if (q.locationTag) {
      qEntry.location_tag = q.locationTag;
    }
    
    // Add location_counts if any entries have location data (no threshold — raw data for agent filtering)
    // Agents filter client-side; privacy thresholds only apply to displayed aggregations
    if (Object.keys(q.locationCountMap).length > 0) {
      qEntry.locations = q.locationCountMap;
    }
    
    return qEntry;
  }),
  // Top-level location index for browse-by-location (only locations meeting global threshold)
  location_index: Object.keys(locationIndex).length > 0 ? locationIndex : undefined,
  agent_search_instructions:
    'Fetch this file to find questions. Do NOT read wiki/index.md — use this JSON for faster agent consumption. ' +
    'To get question details, fetch wiki/qa/<slug>/_index.md. ' +
    'For location-based queries, use the location_index object (locations with ' + MIN_LOCATION_INDEX_PARTICIPANTS + '+ entries). ' +
    'Agent-side filtering: match player\'s known location against question locations or location_tag. Never send player location to the server.'
};
writeFileSync(join(ROOT, 'wiki/agent-index.json'), JSON.stringify(agentIndex, null, 2) + '\n', 'utf-8');

console.log(`Reindexed ${questions.length} questions`);
for (const q of questions) {
  console.log(`  ${q.slug}: ${q.entryCount} entries, ${q.pairwiseJudgmentCount} pairwise judgments, phase=${q.phase}`);
}

// Log location aggregation info
const locQuestionCount = questions.filter(q => Object.keys(q.locationCountMap).length > 0).length;
if (locQuestionCount > 0) {
  console.log(`\nLocation data: ${locQuestionCount} questions with location-tagged entries`);
  console.log(`Global location index: ${Object.keys(locationIndex).length} locations`);
}
