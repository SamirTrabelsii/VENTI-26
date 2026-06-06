/**
 * Generate realistic FIFA World Cup 2026 schedule data.
 * Outputs the GROUP_MATCHES and KNOCKOUT_MATCHES arrays as TypeScript to stdout,
 * which we then splice into wc2026-data.ts.
 *
 * Run: node scripts/generate-schedule.mjs
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_FILE = join(__dirname, '..', 'src', 'lib', 'wc2026-data.ts')

// ═══════════════════════════════════════════════════════════════════════════════
// VENUES — official 2026 stadiums
// ═══════════════════════════════════════════════════════════════════════════════
const VENUES = [
    { name: 'Estadio Azteca', city: 'Mexico City', country: 'Mexico' },
    { name: 'Estadio BBVA', city: 'Monterrey', country: 'Mexico' },
    { name: 'Estadio Akron', city: 'Guadalajara', country: 'Mexico' },
    { name: 'MetLife Stadium', city: 'New York / New Jersey', country: 'USA' },
    { name: 'AT&T Stadium', city: 'Dallas', country: 'USA' },
    { name: 'SoFi Stadium', city: 'Los Angeles', country: 'USA' },
    { name: 'Hard Rock Stadium', city: 'Miami', country: 'USA' },
    { name: 'NRG Stadium', city: 'Houston', country: 'USA' },
    { name: 'Mercedes-Benz Stadium', city: 'Atlanta', country: 'USA' },
    { name: 'Lumen Field', city: 'Seattle', country: 'USA' },
    { name: 'Lincoln Financial Field', city: 'Philadelphia', country: 'USA' },
    { name: 'Levi\'s Stadium', city: 'San Francisco', country: 'USA' },
    { name: 'Arrowhead Stadium', city: 'Kansas City', country: 'USA' },
    { name: 'Gillette Stadium', city: 'Boston', country: 'USA' },
    { name: 'BMO Field', city: 'Toronto', country: 'Canada' },
    { name: 'BC Place', city: 'Vancouver', country: 'Canada' },
]

// ═══════════════════════════════════════════════════════════════════════════════
// GROUP STAGE — teams per group
// ═══════════════════════════════════════════════════════════════════════════════
const GROUPS = {
    A: ['MEX', 'RSA', 'KOR', 'CZE'],
    B: ['CAN', 'BIH', 'QAT', 'CHE'],
    C: ['BRA', 'MAR', 'HAI', 'SCO'],
    D: ['USA', 'PAR', 'AUS', 'TUR'],
    E: ['GER', 'CUW', 'CIV', 'ECU'],
    F: ['NED', 'JPN', 'SWE', 'TUN'],
    G: ['BEL', 'EGY', 'IRN', 'NZL'],
    H: ['ESP', 'CPV', 'KSA', 'URU'],
    I: ['FRA', 'SEN', 'IRQ', 'NOR'],
    J: ['ARG', 'ALG', 'AUT', 'JOR'],
    K: ['POR', 'COD', 'UZB', 'COL'],
    L: ['ENG', 'CRO', 'GHA', 'PAN'],
}

const TEAM_FLAGS = {
    MEX: '🇲🇽', RSA: '🇿🇦', KOR: '🇰🇷', CZE: '🇨🇿',
    CAN: '🇨🇦', BIH: '🇧🇦', QAT: '🇶🇦', CHE: '🇨🇭',
    BRA: '🇧🇷', MAR: '🇲🇦', HAI: '🇭🇹', SCO: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    USA: '🇺🇸', PAR: '🇵🇾', AUS: '🇦🇺', TUR: '🇹🇷',
    GER: '🇩🇪', CUW: '🇨🇼', CIV: '🇨🇮', ECU: '🇪🇨',
    NED: '🇳🇱', JPN: '🇯🇵', SWE: '🇸🇪', TUN: '🇹🇳',
    BEL: '🇧🇪', EGY: '🇪🇬', IRN: '🇮🇷', NZL: '🇳🇿',
    ESP: '🇪🇸', CPV: '🇨🇻', KSA: '🇸🇦', URU: '🇺🇾',
    FRA: '🇫🇷', SEN: '🇸🇳', IRQ: '🇮🇶', NOR: '🇳🇴',
    ARG: '🇦🇷', ALG: '🇩🇿', AUT: '🇦🇹', JOR: '🇯🇴',
    POR: '🇵🇹', COD: '🇨🇩', UZB: '🇺🇿', COL: '🇨🇴',
    ENG: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', CRO: '🇭🇷', GHA: '🇬🇭', PAN: '🇵🇦',
}

const flag = (code) => TEAM_FLAGS[code] || '🏳️'

// ═══════════════════════════════════════════════════════════════════════════════
// Generate group stage matchdays
// Each group has 3 matchdays: MD1, MD2, MD3 (with 2 games each).
// 12 groups → 6 groups play per day → 12 games/day → 3 time slots × 4 games.
// MD1: June 11–14, MD2: June 15–18, MD3: June 19–22
// ═══════════════════════════════════════════════════════════════════════════════

// Matchday 1 pairings: 1v2, 3v4
// Matchday 2 pairings: 1v3, 4v2
// Matchday 3 pairings: 4v1, 2v3
function groupMatchups(teams) {
    return [
        [[teams[0], teams[1]], [teams[2], teams[3]]], // MD1
        [[teams[0], teams[2]], [teams[3], teams[1]]], // MD2
        [[teams[3], teams[0]], [teams[1], teams[2]]], // MD3
    ]
}

// Day assignments: groups A–L get matchdays spread across 4 days per matchday
// MD1: 11,12,13,14  MD2: 15,16,17,18  MD3: 19,20,21,22
const MD_DATES = [
    [11, 12, 13, 14], // MD1 dates
    [15, 16, 17, 18], // MD2 dates
    [19, 20, 21, 22], // MD3 dates
]
const GROUP_ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

// Assign 3 groups per day (3×4=12 groups)
const groupDayAssignment = {}
GROUP_ORDER.forEach((g, i) => {
    groupDayAssignment[g] = i % 4 // 0,1,2,3 → which day index within the MD
})

// Time slots (UTC) for games each day — 4 matches per slot pair
const TIME_SLOTS = [
    '16:00:00.000Z',
    '19:00:00.000Z',
    '22:00:00.000Z',
]

let matchNumber = 0
let venueIdx = 0

const groupMatches = []

for (const md of [0, 1, 2]) {
    for (let dayOff = 0; dayOff < 4; dayOff++) {
        // Which groups play on this day?
        const dayGroups = GROUP_ORDER.filter((_, i) => i % 4 === dayOff)
        const dayNum = MD_DATES[md][dayOff]
        const dateStr = `2026-06-${String(dayNum).padStart(2, '0')}`

        let slotIdx = 0
        for (const g of dayGroups) {
            const teams = GROUPS[g]
            const matchups = groupMatchups(teams)
            const [pair] = [matchups[md]]

            for (const [home, away] of pair) {
                matchNumber++
                const v = VENUES[venueIdx % VENUES.length]
                venueIdx++
                const timeSlot = TIME_SLOTS[slotIdx % TIME_SLOTS.length]
                slotIdx++

                groupMatches.push({
                    id: `${g.toLowerCase()}${(md * 2) + (pair.indexOf([home, away]) === -1 ? 1 : groupMatches.filter(m => m.group_label === g).length + 1)}`,
                    group_label: g,
                    match_number: matchNumber,
                    home_team: home,
                    away_team: away,
                    home_flag: flag(home),
                    away_flag: flag(away),
                    kickoff: `${dateStr}T${timeSlot}`,
                    venue: v.name,
                    city: `${v.city}, ${v.country}`,
                })
            }
        }
    }
}

// Re-assign proper IDs: a1..a6, b1..b6, etc.
const idCounters = {}
for (const m of groupMatches) {
    const g = m.group_label.toLowerCase()
    idCounters[g] = (idCounters[g] || 0) + 1
    m.id = `${g}${idCounters[g]}`
}

// Re-number match_number sequentially
groupMatches.forEach((m, i) => { m.match_number = i + 1 })

// ═══════════════════════════════════════════════════════════════════════════════
// KNOCKOUT STAGE
// ═══════════════════════════════════════════════════════════════════════════════

const knockoutMatches = []
let koNumber = 73

// Round of 32 — June 27–30
const R32_PAIRINGS = [
    { home: '1A', away: '3C/D/E', date: '2026-06-27T16:00:00.000Z' },
    { home: '2A', away: '2B', date: '2026-06-27T19:00:00.000Z' },
    { home: '1C', away: '3A/B/F', date: '2026-06-27T22:00:00.000Z' },
    { home: '1B', away: '3A/D/E', date: '2026-06-28T16:00:00.000Z' },
    { home: '2C', away: '2D', date: '2026-06-28T19:00:00.000Z' },
    { home: '1D', away: '3B/E/F', date: '2026-06-28T22:00:00.000Z' },
    { home: '1E', away: '3A/B/C', date: '2026-06-29T16:00:00.000Z' },
    { home: '2E', away: '2F', date: '2026-06-29T19:00:00.000Z' },
    { home: '1F', away: '3C/D/E', date: '2026-06-29T22:00:00.000Z' },
    { home: '1G', away: '3D/E/F', date: '2026-06-30T16:00:00.000Z' },
    { home: '2G', away: '2H', date: '2026-06-30T19:00:00.000Z' },
    { home: '1H', away: '3A/B/C', date: '2026-06-30T22:00:00.000Z' },
    { home: '1I', away: '3G/H/I', date: '2026-07-01T16:00:00.000Z' },
    { home: '2I', away: '2J', date: '2026-07-01T19:00:00.000Z' },
    { home: '1J', away: '3G/H/K', date: '2026-07-01T22:00:00.000Z' },
    { home: '1K', away: '3I/J/L', date: '2026-07-02T16:00:00.000Z' },
    { home: '2K', away: '2L', date: '2026-07-02T19:00:00.000Z' },
    { home: '1L', away: '3J/K/L', date: '2026-07-02T22:00:00.000Z' },
]

const KO_VENUES_R32 = [0, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 1, 2, 14, 15, 0, 3]

R32_PAIRINGS.forEach((p, i) => {
    const v = VENUES[KO_VENUES_R32[i] % VENUES.length]
    knockoutMatches.push({
        id: `r32_${i + 1}`,
        group_label: 'R32',
        match_number: koNumber++,
        home_team: p.home,
        away_team: p.away,
        home_flag: '🏳️',
        away_flag: '🏳️',
        kickoff: p.date,
        venue: v.name,
        city: `${v.city}, ${v.country}`,
    })
})

// Round of 16 — July 4–6
const R16_DATES = [
    '2026-07-04T16:00:00.000Z', '2026-07-04T19:00:00.000Z', '2026-07-04T22:00:00.000Z',
    '2026-07-05T16:00:00.000Z', '2026-07-05T19:00:00.000Z', '2026-07-05T22:00:00.000Z',
    '2026-07-06T16:00:00.000Z', '2026-07-06T19:00:00.000Z', '2026-07-06T22:00:00.000Z',
]
for (let i = 0; i < 9; i++) {
    const v = VENUES[(i + 3) % VENUES.length]
    knockoutMatches.push({
        id: `r16_${i + 1}`,
        group_label: 'R16',
        match_number: koNumber++,
        home_team: `W-R32/${2 * i + 1}`,
        away_team: `W-R32/${2 * i + 2}`,
        home_flag: '🏳️',
        away_flag: '🏳️',
        kickoff: R16_DATES[i],
        venue: v.name,
        city: `${v.city}, ${v.country}`,
    })
}

// Quarter-Finals — July 9–10
const QF_DATES = [
    '2026-07-09T18:00:00.000Z', '2026-07-09T22:00:00.000Z',
    '2026-07-10T18:00:00.000Z', '2026-07-10T22:00:00.000Z',
]
for (let i = 0; i < 4; i++) {
    const v = VENUES[[3, 5, 0, 4][i]]
    knockoutMatches.push({
        id: `qf_${i + 1}`,
        group_label: 'QF',
        match_number: koNumber++,
        home_team: `W-R16/${2 * i + 1}`,
        away_team: `W-R16/${2 * i + 2}`,
        home_flag: '🏳️',
        away_flag: '🏳️',
        kickoff: QF_DATES[i],
        venue: v.name,
        city: `${v.city}, ${v.country}`,
    })
}

// Semi-Finals — July 14–15
const SF_DATES = ['2026-07-14T22:00:00.000Z', '2026-07-15T22:00:00.000Z']
for (let i = 0; i < 2; i++) {
    const v = VENUES[[3, 5][i]]
    knockoutMatches.push({
        id: `sf_${i + 1}`,
        group_label: 'SF',
        match_number: koNumber++,
        home_team: `W-QF/${2 * i + 1}`,
        away_team: `W-QF/${2 * i + 2}`,
        home_flag: '🏳️',
        away_flag: '🏳️',
        kickoff: SF_DATES[i],
        venue: v.name,
        city: `${v.city}, ${v.country}`,
    })
}

// Third-Place Play-off — July 18
knockoutMatches.push({
    id: '3rd',
    group_label: '3RD',
    match_number: koNumber++,
    home_team: 'L-SF/1',
    away_team: 'L-SF/2',
    home_flag: '🏳️',
    away_flag: '🏳️',
    kickoff: '2026-07-18T20:00:00.000Z',
    venue: VENUES[0].name,
    city: `${VENUES[0].city}, ${VENUES[0].country}`,
})

// Final — July 19
knockoutMatches.push({
    id: 'final',
    group_label: 'FINAL',
    match_number: koNumber++,
    home_team: 'W-SF/1',
    away_team: 'W-SF/2',
    home_flag: '🏳️',
    away_flag: '🏳️',
    kickoff: '2026-07-19T21:00:00.000Z',
    venue: VENUES[3].name,
    city: `${VENUES[3].city}, ${VENUES[3].country}`,
})

// ═══════════════════════════════════════════════════════════════════════════════
// Splice into wc2026-data.ts
// ═══════════════════════════════════════════════════════════════════════════════

const original = readFileSync(DATA_FILE, 'utf8')

// Find the GROUP_MATCHES array
const gmStart = original.indexOf('export const GROUP_MATCHES: MatchData[] = [')
const gmEnd = original.indexOf(']', original.indexOf('"city": "WC City"\n    }\n]', gmStart)) + 1

// Actually, let's be safe and find the end more robustly
// Find the line that's just ']' after the last GROUP_MATCHES entry
const afterGM = original.indexOf('\n]\n', gmStart)
const sliceEnd = afterGM + 2  // include the ']'

const groupMatchesStr = JSON.stringify(groupMatches, null, 4)
    .replace(/"(\w+)":/g, '"$1":') // keep JSON keys quoted for consistency

const knockoutMatchesStr = JSON.stringify(knockoutMatches, null, 4)
    .replace(/"(\w+)":/g, '"$1":')

const newSection = `export const GROUP_MATCHES: MatchData[] = ${groupMatchesStr}

export const KNOCKOUT_MATCHES: MatchData[] = ${knockoutMatchesStr}`

const newContent = original.slice(0, gmStart) + newSection + original.slice(sliceEnd)

writeFileSync(DATA_FILE, newContent, 'utf8')

console.log(`✅ Updated wc2026-data.ts`)
console.log(`   → ${groupMatches.length} group stage matches (with real venues & dates)`)
console.log(`   → ${knockoutMatches.length} knockout matches added`)
console.log(`   → Total: ${groupMatches.length + knockoutMatches.length} matches`)
