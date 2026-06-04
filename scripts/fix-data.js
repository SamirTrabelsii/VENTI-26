const fs = require('fs')

let content = fs.readFileSync('./src/lib/wc2026-data.ts', 'utf8')

// Find the position of the last valid closing of the GROUP_MATCHES array
// We look for the last occurrence of the pattern: "city": "WC City"\n    }
// followed by the array close ]
// Strategy: find the FIRST occurrence of the injected garbage and cut there,
// then close the array and append the correct constants.

const junkMarker = '\n// ─── SCORING POINTS'
const junkPos = content.indexOf(junkMarker)

if (junkPos === -1) {
  console.log('No junk found — file may already be clean.')
  process.exit(0)
}

// Everything before the junk is the header + TEAMS + ISO_MAP + start of GROUP_MATCHES
// But the last match entry before the junk might be incomplete (no closing })
// Let's check what's right before the junk
const before = content.slice(0, junkPos)
console.log('Last 200 chars before junk:\n', before.slice(-200))

// We need to close the last match object and the array, then append constants
// The last entry ends with: "city": "WC City"\n    }
// The array needs a closing \n]\n
// Check if it ends with },  (has a comma) or }  (no comma)

let fixedBefore = before.trimEnd()
// Remove trailing comma if present
if (fixedBefore.endsWith(',')) {
  fixedBefore = fixedBefore.slice(0, -1)
}

const suffix = `
]

// ─── SCORING POINTS ───────────────────────────────────────────────────────────
export const POINTS = {
    EXACT_SCORE: 15,
    CORRECT_RESULT: 5,
    R16_PICK: 10,
    QF_PICK: 15,
    SF_PICK: 20,
    FINAL_PICK: 30,
    CHAMPION: 50,
    EARLY_LOCK: 2,
}

// ─── BRACKET STRUCTURE ────────────────────────────────────────────────────────
// WC 2026: 12 groups → top 2 from each (24) + 8 best 3rd place = 32 teams in R32
export const BRACKET_ROUNDS = ['r32', 'r16', 'qf', 'sf', 'final', 'champion'] as const
export type BracketRound = typeof BRACKET_ROUNDS[number]

// R32 slot labels — official 2026 FIFA bracket pairings
export const R32_SLOTS: Array<[string, string]> = [
    ['2A', '2B'],
    ['1C', '2F'],
    ['1E', 'T3'],
    ['1F', '2C'],
    ['2E', '2I'],
    ['1I', 'T3'],
    ['1A', 'T3'],
    ['1L', 'T3'],
    ['1G', 'T3'],
    ['1D', 'T3'],
    ['1H', '2J'],
    ['2K', '2L'],
    ['1B', 'T3'],
    ['2D', '2G'],
    ['1J', '2H'],
    ['1K', 'T3'],
]

// ─── ACHIEVEMENTS ─────────────────────────────────────────────────────────────
export const ACHIEVEMENTS = [
    { id: 'sharpshooter', icon: '🎯', label: 'Sharpshooter', description: '3 exact scores in one round' },
    { id: 'hot_streak', icon: '🔥', label: 'Hot Streak', description: '5 correct results in a row' },
    { id: 'globe_trotter', icon: '🌍', label: 'Globe Trotter', description: 'Predict all 48 group matches' },
    { id: 'nostradamus', icon: '👑', label: 'Nostradamus', description: 'Predict the champion correctly' },
    { id: 'score_oracle', icon: '⚽', label: 'Score Oracle', description: '5 exact scores total' },
    { id: 'contrarian', icon: '🧠', label: 'Contrarian', description: 'Outpredict the community 10 times' },
    { id: 'recruiter', icon: '🤝', label: 'Recruiter', description: 'Bring 5 friends to the platform' },
    { id: 'perfect_day', icon: '✨', label: 'Perfect Day', description: 'All matches on one day correct' },
    { id: 'hat_trick', icon: '🎩', label: 'Hat-trick', description: '3 exact scores in 3 consecutive matches' },
    { id: 'final_whistle', icon: '🏟️', label: 'Final Whistle', description: 'Predict the WC Final score exactly' },
    { id: 'golden_boot', icon: '👢', label: 'Golden Boot', description: 'Predict the top scorer correctly' },
    { id: 'the_oracle', icon: '🔮', label: 'The Oracle', description: 'Top 1% accuracy globally' },
]
`

const fixed = fixedBefore + suffix
fs.writeFileSync('./src/lib/wc2026-data.ts', fixed)
console.log('Fixed! New line count:', fixed.split('\n').length)
