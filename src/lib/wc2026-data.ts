// ─── AVATAR HELPER ───────────────────────────────────────────────────────────
export function getRobohashUrl(seed: string, size = 80): string {
    const clean = encodeURIComponent(seed.trim().toLowerCase())
    return `https://robohash.org/${clean}?set=set1&size=${size}x${size}`
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
    return `https://flagcdn.com/w40/${iso2}.png`
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

export const TEAMS: Team[] = [
    {
        "code": "MEX",
        "name": "Mexico",
        "flag": "🇲🇽",
        "iso2": "mx",
        "fifa_rank": 0,
        "group": "A",
        "pot": 1
    },
    {
        "code": "RSA",
        "name": "South Africa",
        "flag": "🇿🇦",
        "iso2": "za",
        "fifa_rank": 0,
        "group": "A",
        "pot": 2
    },
    {
        "code": "KOR",
        "name": "South Korea",
        "flag": "🇰🇷",
        "iso2": "kr",
        "fifa_rank": 0,
        "group": "A",
        "pot": 3
    },
    {
        "code": "CZE",
        "name": "Czech Republic",
        "flag": "🇨🇿",
        "iso2": "cz",
        "fifa_rank": 0,
        "group": "A",
        "pot": 4
    },
    {
        "code": "CAN",
        "name": "Canada",
        "flag": "🇨🇦",
        "iso2": "ca",
        "fifa_rank": 0,
        "group": "B",
        "pot": 1
    },
    {
        "code": "BIH",
        "name": "Bosnia & Herzegovina",
        "flag": "🇧🇦",
        "iso2": "ba",
        "fifa_rank": 0,
        "group": "B",
        "pot": 2
    },
    {
        "code": "QAT",
        "name": "Qatar",
        "flag": "🇶🇦",
        "iso2": "qa",
        "fifa_rank": 0,
        "group": "B",
        "pot": 3
    },
    {
        "code": "CHE",
        "name": "Switzerland",
        "flag": "🇨🇭",
        "iso2": "ch",
        "fifa_rank": 0,
        "group": "B",
        "pot": 4
    },
    {
        "code": "BRA",
        "name": "Brazil",
        "flag": "🇧🇷",
        "iso2": "br",
        "fifa_rank": 0,
        "group": "C",
        "pot": 1
    },
    {
        "code": "MAR",
        "name": "Morocco",
        "flag": "🇲🇦",
        "iso2": "ma",
        "fifa_rank": 0,
        "group": "C",
        "pot": 2
    },
    {
        "code": "HAI",
        "name": "Haiti",
        "flag": "🇭🇹",
        "iso2": "ht",
        "fifa_rank": 0,
        "group": "C",
        "pot": 3
    },
    {
        "code": "SCO",
        "name": "Scotland",
        "flag": "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
        "iso2": "gb-sct",
        "fifa_rank": 0,
        "group": "C",
        "pot": 4
    },
    {
        "code": "USA",
        "name": "United States",
        "flag": "🇺🇸",
        "iso2": "us",
        "fifa_rank": 0,
        "group": "D",
        "pot": 1
    },
    {
        "code": "PAR",
        "name": "Paraguay",
        "flag": "🇵🇾",
        "iso2": "py",
        "fifa_rank": 0,
        "group": "D",
        "pot": 2
    },
    {
        "code": "AUS",
        "name": "Australia",
        "flag": "🇦🇺",
        "iso2": "au",
        "fifa_rank": 0,
        "group": "D",
        "pot": 3
    },
    {
        "code": "TUR",
        "name": "Turkey",
        "flag": "🇹🇷",
        "iso2": "tr",
        "fifa_rank": 0,
        "group": "D",
        "pot": 4
    },
    {
        "code": "GER",
        "name": "Germany",
        "flag": "🇩🇪",
        "iso2": "de",
        "fifa_rank": 0,
        "group": "E",
        "pot": 1
    },
    {
        "code": "CUW",
        "name": "Curaçao",
        "flag": "🇨🇼",
        "iso2": "cw",
        "fifa_rank": 0,
        "group": "E",
        "pot": 2
    },
    {
        "code": "CIV",
        "name": "Ivory Coast",
        "flag": "🇨🇮",
        "iso2": "ci",
        "fifa_rank": 0,
        "group": "E",
        "pot": 3
    },
    {
        "code": "ECU",
        "name": "Ecuador",
        "flag": "🇪🇨",
        "iso2": "ec",
        "fifa_rank": 0,
        "group": "E",
        "pot": 4
    },
    {
        "code": "NED",
        "name": "Netherlands",
        "flag": "🇳🇱",
        "iso2": "nl",
        "fifa_rank": 0,
        "group": "F",
        "pot": 1
    },
    {
        "code": "JPN",
        "name": "Japan",
        "flag": "🇯🇵",
        "iso2": "jp",
        "fifa_rank": 0,
        "group": "F",
        "pot": 2
    },
    {
        "code": "SWE",
        "name": "Sweden",
        "flag": "🇸🇪",
        "iso2": "se",
        "fifa_rank": 0,
        "group": "F",
        "pot": 3
    },
    {
        "code": "TUN",
        "name": "Tunisia",
        "flag": "🇹🇳",
        "iso2": "tn",
        "fifa_rank": 0,
        "group": "F",
        "pot": 4
    },
    {
        "code": "BEL",
        "name": "Belgium",
        "flag": "🇧🇪",
        "iso2": "be",
        "fifa_rank": 0,
        "group": "G",
        "pot": 1
    },
    {
        "code": "EGY",
        "name": "Egypt",
        "flag": "🇪🇬",
        "iso2": "eg",
        "fifa_rank": 0,
        "group": "G",
        "pot": 2
    },
    {
        "code": "IRN",
        "name": "Iran",
        "flag": "🇮🇷",
        "iso2": "ir",
        "fifa_rank": 0,
        "group": "G",
        "pot": 3
    },
    {
        "code": "NZL",
        "name": "New Zealand",
        "flag": "🇳🇿",
        "iso2": "nz",
        "fifa_rank": 0,
        "group": "G",
        "pot": 4
    },
    {
        "code": "ESP",
        "name": "Spain",
        "flag": "🇪🇸",
        "iso2": "es",
        "fifa_rank": 0,
        "group": "H",
        "pot": 1
    },
    {
        "code": "CPV",
        "name": "Cape Verde",
        "flag": "🇨🇻",
        "iso2": "cv",
        "fifa_rank": 0,
        "group": "H",
        "pot": 2
    },
    {
        "code": "KSA",
        "name": "Saudi Arabia",
        "flag": "🇸🇦",
        "iso2": "sa",
        "fifa_rank": 0,
        "group": "H",
        "pot": 3
    },
    {
        "code": "URU",
        "name": "Uruguay",
        "flag": "🇺🇾",
        "iso2": "uy",
        "fifa_rank": 0,
        "group": "H",
        "pot": 4
    },
    {
        "code": "FRA",
        "name": "France",
        "flag": "🇫🇷",
        "iso2": "fr",
        "fifa_rank": 0,
        "group": "I",
        "pot": 1
    },
    {
        "code": "SEN",
        "name": "Senegal",
        "flag": "🇸🇳",
        "iso2": "sn",
        "fifa_rank": 0,
        "group": "I",
        "pot": 2
    },
    {
        "code": "IRQ",
        "name": "Iraq",
        "flag": "🇮🇶",
        "iso2": "iq",
        "fifa_rank": 0,
        "group": "I",
        "pot": 3
    },
    {
        "code": "NOR",
        "name": "Norway",
        "flag": "🇳🇴",
        "iso2": "no",
        "fifa_rank": 0,
        "group": "I",
        "pot": 4
    },
    {
        "code": "ARG",
        "name": "Argentina",
        "flag": "🇦🇷",
        "iso2": "ar",
        "fifa_rank": 0,
        "group": "J",
        "pot": 1
    },
    {
        "code": "ALG",
        "name": "Algeria",
        "flag": "🇩🇿",
        "iso2": "dz",
        "fifa_rank": 0,
        "group": "J",
        "pot": 2
    },
    {
        "code": "AUT",
        "name": "Austria",
        "flag": "🇦🇹",
        "iso2": "at",
        "fifa_rank": 0,
        "group": "J",
        "pot": 3
    },
    {
        "code": "JOR",
        "name": "Jordan",
        "flag": "🇯🇴",
        "iso2": "jo",
        "fifa_rank": 0,
        "group": "J",
        "pot": 4
    },
    {
        "code": "POR",
        "name": "Portugal",
        "flag": "🇵🇹",
        "iso2": "pt",
        "fifa_rank": 0,
        "group": "K",
        "pot": 1
    },
    {
        "code": "COD",
        "name": "DR Congo",
        "flag": "🇨🇩",
        "iso2": "cd",
        "fifa_rank": 0,
        "group": "K",
        "pot": 2
    },
    {
        "code": "UZB",
        "name": "Uzbekistan",
        "flag": "🇺🇿",
        "iso2": "uz",
        "fifa_rank": 0,
        "group": "K",
        "pot": 3
    },
    {
        "code": "COL",
        "name": "Colombia",
        "flag": "🇨🇴",
        "iso2": "co",
        "fifa_rank": 0,
        "group": "K",
        "pot": 4
    },
    {
        "code": "ENG",
        "name": "England",
        "flag": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
        "iso2": "gb-eng",
        "fifa_rank": 0,
        "group": "L",
        "pot": 1
    },
    {
        "code": "CRO",
        "name": "Croatia",
        "flag": "🇭🇷",
        "iso2": "hr",
        "fifa_rank": 0,
        "group": "L",
        "pot": 2
    },
    {
        "code": "GHA",
        "name": "Ghana",
        "flag": "🇬🇭",
        "iso2": "gh",
        "fifa_rank": 0,
        "group": "L",
        "pot": 3
    },
    {
        "code": "PAN",
        "name": "Panama",
        "flag": "🇵🇦",
        "iso2": "pa",
        "fifa_rank": 0,
        "group": "L",
        "pot": 4
    }
]

export const GROUP_MATCHES: MatchData[] = [
    {
        "id": "a1",
        "group_label": "A",
        "match_number": 1,
        "home_team": "MEX",
        "away_team": "RSA",
        "home_flag": "🇲🇽",
        "away_flag": "🇿🇦",
        "kickoff": "2026-06-11T18:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "a2",
        "group_label": "A",
        "match_number": 2,
        "home_team": "KOR",
        "away_team": "CZE",
        "home_flag": "🇰🇷",
        "away_flag": "🇨🇿",
        "kickoff": "2026-06-11T21:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "a3",
        "group_label": "A",
        "match_number": 3,
        "home_team": "MEX",
        "away_team": "KOR",
        "home_flag": "🇲🇽",
        "away_flag": "🇰🇷",
        "kickoff": "2026-06-15T18:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "a4",
        "group_label": "A",
        "match_number": 4,
        "home_team": "CZE",
        "away_team": "RSA",
        "home_flag": "🇨🇿",
        "away_flag": "🇿🇦",
        "kickoff": "2026-06-15T21:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "a5",
        "group_label": "A",
        "match_number": 5,
        "home_team": "CZE",
        "away_team": "MEX",
        "home_flag": "🇨🇿",
        "away_flag": "🇲🇽",
        "kickoff": "2026-06-19T18:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "a6",
        "group_label": "A",
        "match_number": 6,
        "home_team": "RSA",
        "away_team": "KOR",
        "home_flag": "🇿🇦",
        "away_flag": "🇰🇷",
        "kickoff": "2026-06-19T21:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "b1",
        "group_label": "B",
        "match_number": 7,
        "home_team": "CAN",
        "away_team": "BIH",
        "home_flag": "🇨🇦",
        "away_flag": "🇧🇦",
        "kickoff": "2026-06-12T18:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "b2",
        "group_label": "B",
        "match_number": 8,
        "home_team": "QAT",
        "away_team": "CHE",
        "home_flag": "🇶🇦",
        "away_flag": "🇨🇭",
        "kickoff": "2026-06-12T21:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "b3",
        "group_label": "B",
        "match_number": 9,
        "home_team": "CAN",
        "away_team": "QAT",
        "home_flag": "🇨🇦",
        "away_flag": "🇶🇦",
        "kickoff": "2026-06-16T18:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "b4",
        "group_label": "B",
        "match_number": 10,
        "home_team": "CHE",
        "away_team": "BIH",
        "home_flag": "🇨🇭",
        "away_flag": "🇧🇦",
        "kickoff": "2026-06-16T21:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "b5",
        "group_label": "B",
        "match_number": 11,
        "home_team": "CHE",
        "away_team": "CAN",
        "home_flag": "🇨🇭",
        "away_flag": "🇨🇦",
        "kickoff": "2026-06-20T18:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "b6",
        "group_label": "B",
        "match_number": 12,
        "home_team": "BIH",
        "away_team": "QAT",
        "home_flag": "🇧🇦",
        "away_flag": "🇶🇦",
        "kickoff": "2026-06-20T21:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "c1",
        "group_label": "C",
        "match_number": 13,
        "home_team": "BRA",
        "away_team": "MAR",
        "home_flag": "🇧🇷",
        "away_flag": "🇲🇦",
        "kickoff": "2026-06-13T18:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "c2",
        "group_label": "C",
        "match_number": 14,
        "home_team": "HAI",
        "away_team": "SCO",
        "home_flag": "🇭🇹",
        "away_flag": "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
        "kickoff": "2026-06-13T21:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "c3",
        "group_label": "C",
        "match_number": 15,
        "home_team": "BRA",
        "away_team": "HAI",
        "home_flag": "🇧🇷",
        "away_flag": "🇭🇹",
        "kickoff": "2026-06-17T18:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "c4",
        "group_label": "C",
        "match_number": 16,
        "home_team": "SCO",
        "away_team": "MAR",
        "home_flag": "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
        "away_flag": "🇲🇦",
        "kickoff": "2026-06-17T21:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "c5",
        "group_label": "C",
        "match_number": 17,
        "home_team": "SCO",
        "away_team": "BRA",
        "home_flag": "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
        "away_flag": "🇧🇷",
        "kickoff": "2026-06-21T18:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "c6",
        "group_label": "C",
        "match_number": 18,
        "home_team": "MAR",
        "away_team": "HAI",
        "home_flag": "🇲🇦",
        "away_flag": "🇭🇹",
        "kickoff": "2026-06-21T21:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "d1",
        "group_label": "D",
        "match_number": 19,
        "home_team": "USA",
        "away_team": "PAR",
        "home_flag": "🇺🇸",
        "away_flag": "🇵🇾",
        "kickoff": "2026-06-14T18:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "d2",
        "group_label": "D",
        "match_number": 20,
        "home_team": "AUS",
        "away_team": "TUR",
        "home_flag": "🇦🇺",
        "away_flag": "🇹🇷",
        "kickoff": "2026-06-14T21:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "d3",
        "group_label": "D",
        "match_number": 21,
        "home_team": "USA",
        "away_team": "AUS",
        "home_flag": "🇺🇸",
        "away_flag": "🇦🇺",
        "kickoff": "2026-06-18T18:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "d4",
        "group_label": "D",
        "match_number": 22,
        "home_team": "TUR",
        "away_team": "PAR",
        "home_flag": "🇹🇷",
        "away_flag": "🇵🇾",
        "kickoff": "2026-06-18T21:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "d5",
        "group_label": "D",
        "match_number": 23,
        "home_team": "TUR",
        "away_team": "USA",
        "home_flag": "🇹🇷",
        "away_flag": "🇺🇸",
        "kickoff": "2026-06-22T18:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "d6",
        "group_label": "D",
        "match_number": 24,
        "home_team": "PAR",
        "away_team": "AUS",
        "home_flag": "🇵🇾",
        "away_flag": "🇦🇺",
        "kickoff": "2026-06-22T21:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "e1",
        "group_label": "E",
        "match_number": 25,
        "home_team": "GER",
        "away_team": "CUW",
        "home_flag": "🇩🇪",
        "away_flag": "🇨🇼",
        "kickoff": "2026-06-11T18:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "e2",
        "group_label": "E",
        "match_number": 26,
        "home_team": "CIV",
        "away_team": "ECU",
        "home_flag": "🇨🇮",
        "away_flag": "🇪🇨",
        "kickoff": "2026-06-11T21:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "e3",
        "group_label": "E",
        "match_number": 27,
        "home_team": "GER",
        "away_team": "CIV",
        "home_flag": "🇩🇪",
        "away_flag": "🇨🇮",
        "kickoff": "2026-06-15T18:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "e4",
        "group_label": "E",
        "match_number": 28,
        "home_team": "ECU",
        "away_team": "CUW",
        "home_flag": "🇪🇨",
        "away_flag": "🇨🇼",
        "kickoff": "2026-06-15T21:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "e5",
        "group_label": "E",
        "match_number": 29,
        "home_team": "ECU",
        "away_team": "GER",
        "home_flag": "🇪🇨",
        "away_flag": "🇩🇪",
        "kickoff": "2026-06-19T18:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "e6",
        "group_label": "E",
        "match_number": 30,
        "home_team": "CUW",
        "away_team": "CIV",
        "home_flag": "🇨🇼",
        "away_flag": "🇨🇮",
        "kickoff": "2026-06-19T21:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "f1",
        "group_label": "F",
        "match_number": 31,
        "home_team": "NED",
        "away_team": "JPN",
        "home_flag": "🇳🇱",
        "away_flag": "🇯🇵",
        "kickoff": "2026-06-12T18:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "f2",
        "group_label": "F",
        "match_number": 32,
        "home_team": "SWE",
        "away_team": "TUN",
        "home_flag": "🇸🇪",
        "away_flag": "🇹🇳",
        "kickoff": "2026-06-12T21:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "f3",
        "group_label": "F",
        "match_number": 33,
        "home_team": "NED",
        "away_team": "SWE",
        "home_flag": "🇳🇱",
        "away_flag": "🇸🇪",
        "kickoff": "2026-06-16T18:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "f4",
        "group_label": "F",
        "match_number": 34,
        "home_team": "TUN",
        "away_team": "JPN",
        "home_flag": "🇹🇳",
        "away_flag": "🇯🇵",
        "kickoff": "2026-06-16T21:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "f5",
        "group_label": "F",
        "match_number": 35,
        "home_team": "TUN",
        "away_team": "NED",
        "home_flag": "🇹🇳",
        "away_flag": "🇳🇱",
        "kickoff": "2026-06-20T18:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "f6",
        "group_label": "F",
        "match_number": 36,
        "home_team": "JPN",
        "away_team": "SWE",
        "home_flag": "🇯🇵",
        "away_flag": "🇸🇪",
        "kickoff": "2026-06-20T21:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "g1",
        "group_label": "G",
        "match_number": 37,
        "home_team": "BEL",
        "away_team": "EGY",
        "home_flag": "🇧🇪",
        "away_flag": "🇪🇬",
        "kickoff": "2026-06-13T18:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "g2",
        "group_label": "G",
        "match_number": 38,
        "home_team": "IRN",
        "away_team": "NZL",
        "home_flag": "🇮🇷",
        "away_flag": "🇳🇿",
        "kickoff": "2026-06-13T21:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "g3",
        "group_label": "G",
        "match_number": 39,
        "home_team": "BEL",
        "away_team": "IRN",
        "home_flag": "🇧🇪",
        "away_flag": "🇮🇷",
        "kickoff": "2026-06-17T18:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "g4",
        "group_label": "G",
        "match_number": 40,
        "home_team": "NZL",
        "away_team": "EGY",
        "home_flag": "🇳🇿",
        "away_flag": "🇪🇬",
        "kickoff": "2026-06-17T21:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "g5",
        "group_label": "G",
        "match_number": 41,
        "home_team": "NZL",
        "away_team": "BEL",
        "home_flag": "🇳🇿",
        "away_flag": "🇧🇪",
        "kickoff": "2026-06-21T18:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "g6",
        "group_label": "G",
        "match_number": 42,
        "home_team": "EGY",
        "away_team": "IRN",
        "home_flag": "🇪🇬",
        "away_flag": "🇮🇷",
        "kickoff": "2026-06-21T21:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "h1",
        "group_label": "H",
        "match_number": 43,
        "home_team": "ESP",
        "away_team": "CPV",
        "home_flag": "🇪🇸",
        "away_flag": "🇨🇻",
        "kickoff": "2026-06-14T18:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "h2",
        "group_label": "H",
        "match_number": 44,
        "home_team": "KSA",
        "away_team": "URU",
        "home_flag": "🇸🇦",
        "away_flag": "🇺🇾",
        "kickoff": "2026-06-14T21:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "h3",
        "group_label": "H",
        "match_number": 45,
        "home_team": "ESP",
        "away_team": "KSA",
        "home_flag": "🇪🇸",
        "away_flag": "🇸🇦",
        "kickoff": "2026-06-18T18:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "h4",
        "group_label": "H",
        "match_number": 46,
        "home_team": "URU",
        "away_team": "CPV",
        "home_flag": "🇺🇾",
        "away_flag": "🇨🇻",
        "kickoff": "2026-06-18T21:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "h5",
        "group_label": "H",
        "match_number": 47,
        "home_team": "URU",
        "away_team": "ESP",
        "home_flag": "🇺🇾",
        "away_flag": "🇪🇸",
        "kickoff": "2026-06-22T18:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "h6",
        "group_label": "H",
        "match_number": 48,
        "home_team": "CPV",
        "away_team": "KSA",
        "home_flag": "🇨🇻",
        "away_flag": "🇸🇦",
        "kickoff": "2026-06-22T21:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "i1",
        "group_label": "I",
        "match_number": 49,
        "home_team": "FRA",
        "away_team": "SEN",
        "home_flag": "🇫🇷",
        "away_flag": "🇸🇳",
        "kickoff": "2026-06-11T18:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "i2",
        "group_label": "I",
        "match_number": 50,
        "home_team": "IRQ",
        "away_team": "NOR",
        "home_flag": "🇮🇶",
        "away_flag": "🇳🇴",
        "kickoff": "2026-06-11T21:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "i3",
        "group_label": "I",
        "match_number": 51,
        "home_team": "FRA",
        "away_team": "IRQ",
        "home_flag": "🇫🇷",
        "away_flag": "🇮🇶",
        "kickoff": "2026-06-15T18:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "i4",
        "group_label": "I",
        "match_number": 52,
        "home_team": "NOR",
        "away_team": "SEN",
        "home_flag": "🇳🇴",
        "away_flag": "🇸🇳",
        "kickoff": "2026-06-15T21:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "i5",
        "group_label": "I",
        "match_number": 53,
        "home_team": "NOR",
        "away_team": "FRA",
        "home_flag": "🇳🇴",
        "away_flag": "🇫🇷",
        "kickoff": "2026-06-19T18:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "i6",
        "group_label": "I",
        "match_number": 54,
        "home_team": "SEN",
        "away_team": "IRQ",
        "home_flag": "🇸🇳",
        "away_flag": "🇮🇶",
        "kickoff": "2026-06-19T21:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "j1",
        "group_label": "J",
        "match_number": 55,
        "home_team": "ARG",
        "away_team": "ALG",
        "home_flag": "🇦🇷",
        "away_flag": "🇩🇿",
        "kickoff": "2026-06-12T18:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "j2",
        "group_label": "J",
        "match_number": 56,
        "home_team": "AUT",
        "away_team": "JOR",
        "home_flag": "🇦🇹",
        "away_flag": "🇯🇴",
        "kickoff": "2026-06-12T21:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "j3",
        "group_label": "J",
        "match_number": 57,
        "home_team": "ARG",
        "away_team": "AUT",
        "home_flag": "🇦🇷",
        "away_flag": "🇦🇹",
        "kickoff": "2026-06-16T18:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "j4",
        "group_label": "J",
        "match_number": 58,
        "home_team": "JOR",
        "away_team": "ALG",
        "home_flag": "🇯🇴",
        "away_flag": "🇩🇿",
        "kickoff": "2026-06-16T21:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "j5",
        "group_label": "J",
        "match_number": 59,
        "home_team": "JOR",
        "away_team": "ARG",
        "home_flag": "🇯🇴",
        "away_flag": "🇦🇷",
        "kickoff": "2026-06-20T18:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "j6",
        "group_label": "J",
        "match_number": 60,
        "home_team": "ALG",
        "away_team": "AUT",
        "home_flag": "🇩🇿",
        "away_flag": "🇦🇹",
        "kickoff": "2026-06-20T21:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "k1",
        "group_label": "K",
        "match_number": 61,
        "home_team": "POR",
        "away_team": "COD",
        "home_flag": "🇵🇹",
        "away_flag": "🇨🇩",
        "kickoff": "2026-06-13T18:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "k2",
        "group_label": "K",
        "match_number": 62,
        "home_team": "UZB",
        "away_team": "COL",
        "home_flag": "🇺🇿",
        "away_flag": "🇨🇴",
        "kickoff": "2026-06-13T21:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "k3",
        "group_label": "K",
        "match_number": 63,
        "home_team": "POR",
        "away_team": "UZB",
        "home_flag": "🇵🇹",
        "away_flag": "🇺🇿",
        "kickoff": "2026-06-17T18:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "k4",
        "group_label": "K",
        "match_number": 64,
        "home_team": "COL",
        "away_team": "COD",
        "home_flag": "🇨🇴",
        "away_flag": "🇨🇩",
        "kickoff": "2026-06-17T21:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "k5",
        "group_label": "K",
        "match_number": 65,
        "home_team": "COL",
        "away_team": "POR",
        "home_flag": "🇨🇴",
        "away_flag": "🇵🇹",
        "kickoff": "2026-06-21T18:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "k6",
        "group_label": "K",
        "match_number": 66,
        "home_team": "COD",
        "away_team": "UZB",
        "home_flag": "🇨🇩",
        "away_flag": "🇺🇿",
        "kickoff": "2026-06-21T21:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "l1",
        "group_label": "L",
        "match_number": 67,
        "home_team": "ENG",
        "away_team": "CRO",
        "home_flag": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
        "away_flag": "🇭🇷",
        "kickoff": "2026-06-14T18:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "l2",
        "group_label": "L",
        "match_number": 68,
        "home_team": "GHA",
        "away_team": "PAN",
        "home_flag": "🇬🇭",
        "away_flag": "🇵🇦",
        "kickoff": "2026-06-14T21:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "l3",
        "group_label": "L",
        "match_number": 69,
        "home_team": "ENG",
        "away_team": "GHA",
        "home_flag": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
        "away_flag": "🇬🇭",
        "kickoff": "2026-06-18T18:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "l4",
        "group_label": "L",
        "match_number": 70,
        "home_team": "CRO",
        "away_team": "PAN",
        "home_flag": "🇭🇷",
        "away_flag": "🇵🇦",
        "kickoff": "2026-06-18T21:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "l5",
        "group_label": "L",
        "match_number": 71,
        "home_team": "CRO",
        "away_team": "GHA",
        "home_flag": "🇭🇷",
        "away_flag": "🇬🇭",
        "kickoff": "2026-06-22T18:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    },
    {
        "id": "l6",
        "group_label": "L",
        "match_number": 72,
        "home_team": "PAN",
        "away_team": "ENG",
        "home_flag": "🇵🇦",
        "away_flag": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
        "kickoff": "2026-06-22T21:00:00.000Z",
        "venue": "WC Stadium",
        "city": "WC City"
    }
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
