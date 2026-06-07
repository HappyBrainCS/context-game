import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { join, basename } from 'path';

const ROOT = process.cwd();
const QA_DIR = join(ROOT, 'wiki/qa');
const PEOPLE_DIR = join(ROOT, 'wiki/people');

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

function loadJudgeWeight(judgeId) {
  const path = join(PEOPLE_DIR, `${judgeId}/judgment-record.md`);
  if (!existsSync(path)) return 1.0;
  const fields = readYamlHead(path);
  return parseFloat(fields.weight) || 1.0;
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

  // Active entries
  const entriesDir = join(qDir, 'entries');
  const activeEntries = [];
  if (existsSync(entriesDir)) {
    const files = readdirSync(entriesDir).filter(f => f.endsWith('.md') && f !== '.gitkeep');
    for (const file of files) {
      const meta = readYamlHead(join(entriesDir, file));
      activeEntries.push({ filename: file, author: meta.author || 'unknown', title: meta.title || '', links: meta.links || '' });
    }
  }

  // Archived count
  const archivedDir = join(qDir, 'archived');
  const archivedCount = existsSync(archivedDir) ? readdirSync(archivedDir).filter(f => f.endsWith('.md') && f !== '.gitkeep').length : 0;

  // Judgments
  const judgmentsDir = join(qDir, 'judgments');
  const judgments = [];
  if (existsSync(judgmentsDir)) {
    for (const file of readdirSync(judgmentsDir).filter(f => f.endsWith('.md') && f !== '.gitkeep')) {
      const meta = readYamlHead(join(judgmentsDir, file));
      judgments.push({ judge: meta.judge || '', entry: meta.entry || '', useful: parseInt(meta.useful) || 0 });
    }
  }

  // Poll data
  const pollDir = join(qDir, 'poll');
  const pollEntries = [];
  if (existsSync(pollDir)) {
    for (const file of readdirSync(pollDir).filter(f => f.endsWith('.md') && f !== '.gitkeep')) {
      const meta = readYamlHead(join(pollDir, file));
      pollEntries.push({ participant: meta.participant || '', answer: meta['answer-summary'] || '' });
    }
  }

  // Compute rankings
  const entryRankings = activeEntries.map(entry => {
    const entryJudgments = judgments.filter(j => j.entry === entry.filename);
    if (entryJudgments.length === 0) return { ...entry, score: null, judgmentCount: 0 };

    let totalWeight = 0, weightedSum = 0;
    for (const j of entryJudgments) {
      const w = loadJudgeWeight(j.judge);
      totalWeight += w;
      weightedSum += j.useful * w;
    }
    const weightedUsefulness = totalWeight > 0 ? weightedSum / totalWeight : 0;
    const confidence = Math.log10(totalWeight + 1);
    return { ...entry, score: weightedUsefulness * confidence, judgmentCount: entryJudgments.length };
  });
  entryRankings.sort((a, b) => { if (a.score === null && b.score === null) return 0; if (a.score === null) return 1; if (b.score === null) return -1; return b.score - a.score; });

  // Last activity
  let lastActivity = qMeta.created || '';
  const allDirs = [entriesDir, judgmentsDir, pollDir];
  for (const d of allDirs) {
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d).filter(f => f.endsWith('.md') && f !== '.gitkeep')) {
      const meta = readYamlHead(join(d, f));
      if (meta.created && meta.created > lastActivity) lastActivity = meta.created;
    }
  }

  questions.push({
    slug, title, createdBy, lastActivity,
    entryCount: activeEntries.length, archivedCount, judgmentCount: judgments.length,
    participantCount: new Set([...activeEntries.map(e => e.author), ...judgments.map(j => j.judge)]).size,
    phrase: activeEntries.length < 4 ? 'collecting' : 'judging',
    entryRankings, pollEntries
  });
}

questions.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity) || b.entryCount - a.entryCount);

// --- Generate _index.md per question ---
for (const q of questions) {
  const qDir = join(QA_DIR, q.slug);
  let md = `# ${q.title}\n\n## Stats\n`;
  md += `- **Participants:** ${q.participantCount}\n- **Entries:** ${q.entryCount} active`;
  if (q.archivedCount > 0) md += `, ${q.archivedCount} archived`;
  md += `\n- **Judgments:** ${q.judgmentCount}\n- **Updated:** ${q.lastActivity}\n- **Phase:** ${q.phrase}\n\n`;

  if (q.pollEntries.length > 0) {
    md += `### What People Think\n`;
    for (const p of q.pollEntries) md += `- *${p.answer}* — ${p.participant}\n`;
    md += '\n';
  }

  md += `## Ranked Entries\n\n`;
  if (q.entryRankings.length === 0) {
    md += `*No entries yet. Be the first to answer this question.*\n\n`;
  } else {
    for (let i = 0; i < q.entryRankings.length; i++) {
      const e = q.entryRankings[i];
      const rank = i + 1;
      const scoreStr = e.score !== null ? e.score.toFixed(2) : '—';
      const isTop10 = rank <= 10;
      md += `### #${rank} — ${e.title}\n`;
      if (isTop10) {
        md += `*by ${e.author} | Score: ${scoreStr} | ${e.judgmentCount} judgments*\n`;
        if (e.links) md += `*Links: ${e.links}*\n`;
      } else {
        md += `*Score: ${scoreStr} | ${e.judgmentCount} judgments*\n`;
      }
      md += '\n**[Tell your agent: "load entry #' + rank + '" to read the full entry and judge it.]**\n\n';
    }
  }
  md += `---\n*Judgments are transparent: each entry shows how many people evaluated it and the final score.*\n`;
  writeFileSync(join(qDir, '_index.md'), md, 'utf-8');
}

// --- Generate wiki/index.md ---
let indexMd = `# Context Game — Question Index\n\n`;
indexMd += `> **For AI agents:** This repo has a machine-readable index at \`wiki/agent-index.json\`.\n`;
indexMd += `> Fetch that instead of this file — it's faster and scales to thousands of questions.\n\n`;
indexMd += `## Active Questions\n\n| Question | Entries | Judgments | Last Activity | Ask Credit |\n|---|---|---|---|---|\n`;
for (const q of questions) {
  indexMd += `| [[wiki/qa/${q.slug}/_index.md\\|${q.title}]] | ${q.entryCount} | ${q.judgmentCount} | ${q.lastActivity || '—'} | ${q.createdBy} |\n`;
}
writeFileSync(join(ROOT, 'wiki/index.md'), indexMd, 'utf-8');

// --- Generate wiki/agent-index.json ---
const agentIndex = {
  game: 'Context Game',
  repo: 'HappyBrainCS/context-game',
  updated: new Date().toISOString().split('T')[0],
  agent_protocol: 'https://github.com/HappyBrainCS/context-game/blob/main/AGENTS.md',
  questions: questions.map(q => ({
    slug: q.slug, title: q.title,
    entry_count: q.entryCount, judgment_count: q.judgmentCount,
    participant_count: q.participantCount, last_activity: q.lastActivity,
    ask_credit: q.createdBy, phase: q.phrase
  })),
  agent_search_instructions: 'Fetch this file to find questions. Do NOT read wiki/index.md — use this JSON for faster agent consumption. To get question details, fetch wiki/qa/<slug>/_index.md.'
};
writeFileSync(join(ROOT, 'wiki/agent-index.json'), JSON.stringify(agentIndex, null, 2) + '\n', 'utf-8');

console.log(`Reindexed ${questions.length} questions`);
for (const q of questions) console.log(`  ${q.slug}: ${q.entryCount} entries, ${q.judgmentCount} judgments, phase=${q.phrase}`);
