const fs = require('fs')

// Read current file to extract the TEAMS and GROUP_MATCHES JSON arrays
const content = fs.readFileSync('./src/lib/wc2026-data.ts', 'utf8')

// Extract TEAMS array
const teamsMatch = content.match(/export const TEAMS: Team\[\] = (\[[\s\S]*?\n\])/)
if (!teamsMatch) { console.error('Cannot find TEAMS'); process.exit(1) }
const teamsJson = teamsMatch[1]

// Extract GROUP_MATCHES array — it's the second big array
const matchesMatch = content.match(/export const GROUP_MATCHES: MatchData\[\] = (\[[\s\S]*?\n\])/)
if (!matchesMatch) { console.error('Cannot find GROUP_MATCHES'); process.exit(1) }
const matchesJson = matchesMatch[1]

const output = `// ─── AVATAR HELPER ───────────────────────────────────────────────────────────
export function getRobohashUrl(seed: string, size = 80): string {
    const clean = encodeURIComponent(seed.trim().toLowerCase())
    return \`https://robohash.org/\${clean}?set=set1&size=\${size}x\${size}\`
}

// ─── TEAMS ───────────────────────────────────────────────────────────────────
// Official FIFA World Cup 2026 — 48 teams across 12 groups of 4
export interface Team {
    code: string
    name: string
    flag: string
    iso2: string
    fifa_rank: number
    group: string
    pot: number
}

// ─── ISO MAP ──────────────────────────────────────────────────────────────────
// Maps 3-letter team codes to ISO 3166-1 alpha-2 codes for flagcdn.com
export const ISO_MAP: Record<string, string> = {
    MEX: 'mx', RSA: 'za', KOR: 'kr', CZE: 'cz',
    CAN: 'ca', BIH: 'ba', QAT: 'qa', CHE: 'ch',
    BRA: 'br', MAR: 'ma', HAI: 'ht', SCO: 'gb-sct',
    USA: 'us', PAR: 'py', AUS: 'au', TUR: 'tr',
    GER: 'de', CUW: 'cw', CIV: 'ci', ECU: 'ec',
    NED: 'nl', JPN: 'jp', SWE: 'se', TUN: 'tn',
    BEL: 'be', EGY: 'eg', IRN: 'ir', NZL: 'nz',
    ESP: 'es', CPV: 'cv', KSA: 'sa', URU: 'uy',
    FRA: 'fr', SEN: 'sn', IRQ: 'iq', NOR: 'no',
    ARG: 'ar', ALG: 'dz', AUT: 'at', JOR: 'jo',
    POR: 'pt', COD: 'cd', UZB: 'uz', COL: 'co',
    ENG: 'gb-eng', CRO: 'hr', GHA: 'gh', PAN: 'pa',
}

export function getFlagUrl(code: string): string {
    const iso2 = ISO_MAP[code] ?? code.toLowerCase()
    return \`https://flagcdn.com/w40/\${iso2}.png\`
}

export function getTeam(code: string): Team | undefined {
    return TEAMS.find(t => t.code === code)
}

export const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

// ─── MATCH DATA ───────────────────────────────────────────────────────────────
export interface MatchData {
    id: string
    group_label: string
    match_number: number
    home_team: string
    away_team: string
    home_flag: string
    away_flag: string
    kickoff: string
    venue: string
    city: string
}

export function getGroupMatches(group: string): MatchData[] {
    return GROUP_MATCHES.filter(m => m.group_label === group)
}

export const TEAMS: Team[] = ${teamsJson}

export const GROUP_MATCHES: MatchData[] = ${matchesJson}

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

// Official 2026 FIFA R32 bracket pairings
// 1X = 1st place group X, 2X = 2nd place group X, T3 = best third-placed team
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

fs.writeFileSync('./src/lib/wc2026-data.ts', output)
console.log('Rebuilt wc2026-data.ts — lines:', output.split('\n').length)
