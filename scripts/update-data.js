const fs = require('fs')

const rawGroups = {
  A: [
    { code: 'MEX', name: 'Mexico', iso2: 'mx', flag: '🇲🇽' },
    { code: 'RSA', name: 'South Africa', iso2: 'za', flag: '🇿🇦' },
    { code: 'KOR', name: 'South Korea', iso2: 'kr', flag: '🇰🇷' },
    { code: 'CZE', name: 'Czech Republic', iso2: 'cz', flag: '🇨🇿' }
  ],
  B: [
    { code: 'CAN', name: 'Canada', iso2: 'ca', flag: '🇨🇦' },
    { code: 'BIH', name: 'Bosnia & Herzegovina', iso2: 'ba', flag: '🇧🇦' },
    { code: 'QAT', name: 'Qatar', iso2: 'qa', flag: '🇶🇦' },
    { code: 'CHE', name: 'Switzerland', iso2: 'ch', flag: '🇨🇭' }
  ],
  C: [
    { code: 'BRA', name: 'Brazil', iso2: 'br', flag: '🇧🇷' },
    { code: 'MAR', name: 'Morocco', iso2: 'ma', flag: '🇲🇦' },
    { code: 'HAI', name: 'Haiti', iso2: 'ht', flag: '🇭🇹' },
    { code: 'SCO', name: 'Scotland', iso2: 'gb-sct', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' }
  ],
  D: [
    { code: 'USA', name: 'United States', iso2: 'us', flag: '🇺🇸' },
    { code: 'PAR', name: 'Paraguay', iso2: 'py', flag: '🇵🇾' },
    { code: 'AUS', name: 'Australia', iso2: 'au', flag: '🇦🇺' },
    { code: 'TUR', name: 'Turkey', iso2: 'tr', flag: '🇹🇷' }
  ],
  E: [
    { code: 'GER', name: 'Germany', iso2: 'de', flag: '🇩🇪' },
    { code: 'CUW', name: 'Curaçao', iso2: 'cw', flag: '🇨🇼' },
    { code: 'CIV', name: 'Ivory Coast', iso2: 'ci', flag: '🇨🇮' },
    { code: 'ECU', name: 'Ecuador', iso2: 'ec', flag: '🇪🇨' }
  ],
  F: [
    { code: 'NED', name: 'Netherlands', iso2: 'nl', flag: '🇳🇱' },
    { code: 'JPN', name: 'Japan', iso2: 'jp', flag: '🇯🇵' },
    { code: 'SWE', name: 'Sweden', iso2: 'se', flag: '🇸🇪' },
    { code: 'TUN', name: 'Tunisia', iso2: 'tn', flag: '🇹🇳' }
  ],
  G: [
    { code: 'BEL', name: 'Belgium', iso2: 'be', flag: '🇧🇪' },
    { code: 'EGY', name: 'Egypt', iso2: 'eg', flag: '🇪🇬' },
    { code: 'IRN', name: 'Iran', iso2: 'ir', flag: '🇮🇷' },
    { code: 'NZL', name: 'New Zealand', iso2: 'nz', flag: '🇳🇿' }
  ],
  H: [
    { code: 'ESP', name: 'Spain', iso2: 'es', flag: '🇪🇸' },
    { code: 'CPV', name: 'Cape Verde', iso2: 'cv', flag: '🇨🇻' },
    { code: 'KSA', name: 'Saudi Arabia', iso2: 'sa', flag: '🇸🇦' },
    { code: 'URU', name: 'Uruguay', iso2: 'uy', flag: '🇺🇾' }
  ],
  I: [
    { code: 'FRA', name: 'France', iso2: 'fr', flag: '🇫🇷' },
    { code: 'SEN', name: 'Senegal', iso2: 'sn', flag: '🇸🇳' },
    { code: 'IRQ', name: 'Iraq', iso2: 'iq', flag: '🇮🇶' },
    { code: 'NOR', name: 'Norway', iso2: 'no', flag: '🇳🇴' }
  ],
  J: [
    { code: 'ARG', name: 'Argentina', iso2: 'ar', flag: '🇦🇷' },
    { code: 'ALG', name: 'Algeria', iso2: 'dz', flag: '🇩🇿' },
    { code: 'AUT', name: 'Austria', iso2: 'at', flag: '🇦🇹' },
    { code: 'JOR', name: 'Jordan', iso2: 'jo', flag: '🇯🇴' }
  ],
  K: [
    { code: 'POR', name: 'Portugal', iso2: 'pt', flag: '🇵🇹' },
    { code: 'COD', name: 'DR Congo', iso2: 'cd', flag: '🇨🇩' },
    { code: 'UZB', name: 'Uzbekistan', iso2: 'uz', flag: '🇺🇿' },
    { code: 'COL', name: 'Colombia', iso2: 'co', flag: '🇨🇴' }
  ],
  L: [
    { code: 'ENG', name: 'England', iso2: 'gb-eng', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
    { code: 'CRO', name: 'Croatia', iso2: 'hr', flag: '🇭🇷' },
    { code: 'GHA', name: 'Ghana', iso2: 'gh', flag: '🇬🇭' },
    { code: 'PAN', name: 'Panama', iso2: 'pa', flag: '🇵🇦' }
  ]
}

const teams = []
const isoMap = {}
const matches = []

let matchCount = 1
let dayOffset = 0

for (const [group, groupTeams] of Object.entries(rawGroups)) {
  groupTeams.forEach((t, i) => {
    teams.push({
      code: t.code,
      name: t.name,
      flag: t.flag,
      iso2: t.iso2,
      fifa_rank: 0, // Placeholder
      group: group,
      pot: i + 1
    })
    isoMap[t.code] = t.iso2
  })

  // Fixtures logic: 1v2, 3v4, 1v3, 4v2, 4v1, 2v3
  const fixtureList = [
    [0, 1],
    [2, 3],
    [0, 2],
    [3, 1],
    [3, 0],
    [1, 2]
  ]

  fixtureList.forEach((fix, idx) => {
    const home = groupTeams[fix[0]]
    const away = groupTeams[fix[1]]
    
    // Distribute kickoff dates across the group stage (approximate)
    const date = new Date(Date.UTC(2026, 5, 11 + dayOffset + Math.floor(idx / 2) * 4, 18 + (idx % 2) * 3, 0, 0))
    const kickoff = date.toISOString()
    
    matches.push({
      id: `${group.toLowerCase()}${idx + 1}`,
      group_label: group,
      match_number: matchCount++,
      home_team: home.code,
      away_team: away.code,
      home_flag: home.flag,
      away_flag: away.flag,
      kickoff: kickoff,
      venue: 'WC Stadium',
      city: 'WC City'
    })
  })
  dayOffset = (dayOffset + 1) % 4
}

let content = fs.readFileSync('./src/lib/wc2026-data.ts', 'utf-8')

// Replace TEAMS
content = content.replace(/export const TEAMS: Team\[\] = \[[\s\S]*?\]/, `export const TEAMS: Team[] = ${JSON.stringify(teams, null, 4)}`)

// Replace ISO_MAP
content = content.replace(/export const ISO_MAP: Record<string, string> = {[\s\S]*?}/, `export const ISO_MAP: Record<string, string> = ${JSON.stringify(isoMap, null, 4)}`)

// Replace GROUP_MATCHES
content = content.replace(/export const GROUP_MATCHES: MatchData\[\] = \[[\s\S]*?\]/, `export const GROUP_MATCHES: MatchData[] = ${JSON.stringify(matches, null, 4)}`)

fs.writeFileSync('./src/lib/wc2026-data.ts', content)
console.log('Updated wc2026-data.ts')
