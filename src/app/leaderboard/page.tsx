import { createClient } from '@/lib/supabase/server'
import { GROUP_MATCHES, KNOCKOUT_MATCHES } from '@/lib/wc2026-data'
import Nav from '@/components/Nav'
import LeaderboardClient, { LeaderboardScope, LeaderboardUser } from './LeaderboardClient'
import { fetchAllRows } from '@/lib/supabase/pagination'
import { computeFreshScores, normalizeBracketPickForScoring } from '@/lib/fresh-scores'

const GROUP_TOTAL = GROUP_MATCHES.length   // 72
const KNOCKOUT_TOTAL = 32                  // R32(16)+R16(8)+QF(4)+SF(2)+3rd(1)+Final(1)
const TOTAL_MATCHES = GROUP_TOTAL + KNOCKOUT_TOTAL  // 104
const ALL_MATCHES = [...GROUP_MATCHES, ...KNOCKOUT_MATCHES]
const GROUP_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

const TEAM_NAME_TO_CODE: Record<string, string> = {
    'Mexico': 'MEX', 'South Africa': 'RSA', 'Korea Republic': 'KOR', 'South Korea': 'KOR',
    'Czechia': 'CZE', 'Czech Republic': 'CZE', 'Canada': 'CAN', 'Bosnia-Herzegovina': 'BIH',
    'Bosnia and Herzegovina': 'BIH', 'United States': 'USA', 'Paraguay': 'PAR', 'Qatar': 'QAT',
    'Switzerland': 'SUI', 'Brazil': 'BRA', 'Morocco': 'MAR', 'Haiti': 'HAI', 'Scotland': 'SCO',
    'Australia': 'AUS', 'Turkey': 'TUR', 'Germany': 'GER', 'Curacao': 'CUW', 'Netherlands': 'NED',
    'Japan': 'JPN', 'Ivory Coast': 'CIV', 'Ecuador': 'ECU', 'Sweden': 'SWE', 'Tunisia': 'TUN',
    'Spain': 'ESP', 'Cape Verde Islands': 'CPV', 'Cape Verde': 'CPV', 'Belgium': 'BEL',
    'Egypt': 'EGY', 'Saudi Arabia': 'KSA', 'Uruguay': 'URU', 'Iran': 'IRN', 'New Zealand': 'NZL',
    'France': 'FRA', 'Senegal': 'SEN', 'Iraq': 'IRQ', 'Norway': 'NOR', 'Argentina': 'ARG',
    'Algeria': 'ALG', 'Austria': 'AUT', 'Jordan': 'JOR', 'Portugal': 'POR', 'DR Congo': 'COD',
    'Democratic Republic of the Congo': 'COD', 'Uzbekistan': 'UZB', 'Colombia': 'COL',
    'England': 'ENG', 'Croatia': 'CRO', 'Ghana': 'GHA', 'Panama': 'PAN',
}

function isGroupStageLabel(groupLabel?: string | null) {
    return !groupLabel || !['R32', 'R16', 'QF', 'SF', '3RD', 'FINAL'].includes(groupLabel)
}

function hasScorePair(score: any) {
    return score?.home !== null && score?.home !== undefined
        && score?.away !== null && score?.away !== undefined
}

function sameScore(a: any, b: any) {
    return hasScorePair(a) && hasScorePair(b) && a.home === b.home && a.away === b.away
}

function addScores(a: any, b: any) {
    return { home: a.home + b.home, away: a.away + b.away }
}

function extractScoreAfterExtraTime(apiMatch: any) {
    const regularTime = apiMatch.score?.regularTime
    const extraTime = apiMatch.score?.extraTime
    const fullTime = apiMatch.score?.fullTime

    if (hasScorePair(extraTime) && hasScorePair(regularTime)) {
        const combined = addScores(regularTime, extraTime)
        if (sameScore(fullTime, combined) || sameScore(fullTime, extraTime)) return fullTime
        if (extraTime.home >= regularTime.home && extraTime.away >= regularTime.away) return extraTime
        return combined
    }
    if (hasScorePair(fullTime)) return fullTime
    if (hasScorePair(regularTime)) return regularTime
    return { home: null, away: null }
}

function isGroupWeekMatch(match: any, week: 1 | 2 | 3) {
    if (!GROUP_LABELS.includes(match.group_label)) return false
    const suffix = Number(String(match.id).slice(1))
    if (week === 1) return suffix === 1 || suffix === 2
    if (week === 2) return suffix === 3 || suffix === 4
    return suffix === 5 || suffix === 6
}

function buildScopedLeaderboard(
    profiles: any[],
    finishedMatches: any[],
    groupPredData: any[],
    bracketPredData: any[],
    scope: Omit<LeaderboardScope, 'users' | 'finished_count' | 'match_count'> & { filter: (match: any) => boolean; matchTotal: number },
): LeaderboardScope {
    const scopedMatches = finishedMatches.filter(scope.filter)
    const totals = computeFreshScores(
        profiles.map(p => p.id),
        scopedMatches,
        groupPredData,
        bracketPredData,
    )

    const users = profiles
        .map(p => {
            const score = totals.get(p.id)
            return {
                id: p.id,
                display_name: p.display_name ?? 'Player',
                avatar_initials: p.avatar_initials ?? '??',
                avatar_color: p.avatar_color ?? '#555',
                total_points: score?.total_points ?? 0,
                exact_scores: score?.exact_scores ?? 0,
                correct_results: score?.correct_results ?? 0,
                streak: score?.streak ?? 0,
                group_preds: 0,
                bracket_preds: 0,
                total_preds: 0,
            }
        })
        .filter(user => user.total_points > 0 || scopedMatches.length > 0)
        .sort((a, b) =>
            b.total_points - a.total_points ||
            b.exact_scores - a.exact_scores ||
            b.correct_results - a.correct_results ||
            a.display_name.localeCompare(b.display_name)
        )

    return {
        key: scope.key,
        type: scope.type,
        title: scope.title,
        short_title: scope.short_title,
        subtitle: scope.subtitle,
        match_count: scope.matchTotal,
        finished_count: scopedMatches.length,
        users,
    }
}

async function fetchApiFinishedMatches(dbMatches: any[]) {
    try {
        const res = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
            headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY ?? '' },
            cache: 'no-store',
            signal: AbortSignal.timeout(4500),
        })
        if (!res.ok) return []

        const data = await res.json()
        const finished: any[] = []

        for (const apiMatch of data.matches ?? []) {
            if (apiMatch.status !== 'FINISHED') continue

            const homeCode = TEAM_NAME_TO_CODE[apiMatch.homeTeam?.name] || apiMatch.homeTeam?.tla
            const awayCode = TEAM_NAME_TO_CODE[apiMatch.awayTeam?.name] || apiMatch.awayTeam?.tla
            const score = extractScoreAfterExtraTime(apiMatch)
            const homeScore = score.home
            const awayScore = score.away
            if (!homeCode || !awayCode || typeof homeScore !== 'number' || typeof awayScore !== 'number') continue

            const dbMatch = dbMatches.find((m: any) => m.home_team === homeCode && m.away_team === awayCode)
            if (!dbMatch) {
                console.warn('[LeaderboardPage] Finished API match has no DB match', {
                    home: homeCode,
                    away: awayCode,
                    status: apiMatch.status,
                })
                continue
            }

            const staticMatch = ALL_MATCHES.find(m => m.id === dbMatch.id)
            if (!staticMatch) continue
            const apiQualifier = apiMatch.score?.winner === 'HOME_TEAM'
                ? homeCode
                : apiMatch.score?.winner === 'AWAY_TEAM'
                    ? awayCode
                    : null
            const wentToPenalties = apiMatch.score?.penalties?.home !== null && apiMatch.score?.penalties?.home !== undefined

            finished.push({
                ...staticMatch,
                home_team: dbMatch.home_team ?? homeCode,
                away_team: dbMatch.away_team ?? awayCode,
                stage: dbMatch?.stage ?? (isGroupStageLabel(staticMatch.group_label) ? 'group' : staticMatch.group_label),
                qualifier: dbMatch?.qualifier ?? apiQualifier ?? staticMatch.qualifier ?? null,
                home_score: homeScore,
                away_score: awayScore,
                went_to_penalties: wentToPenalties,
                penalty_home_score: wentToPenalties ? apiMatch.score.penalties.home : dbMatch.penalty_home_score ?? null,
                penalty_away_score: wentToPenalties ? apiMatch.score.penalties.away : dbMatch.penalty_away_score ?? null,
                status: 'finished',
            })
        }

        return finished
    } catch {
        return []
    }
}

export default async function LeaderboardPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let profile = null
    if (user) {
        const { data: profileData } = await supabase
            .from('profiles').select('*').eq('id', user.id).single()
        profile = profileData
    }

    // 1. Fetch ALL registered users
    const allProfiles = await fetchAllRows(
        supabase.from('profiles').select('id, display_name, avatar_initials, avatar_color').order('created_at', { ascending: true })
    )

    // 2. Fetch raw prediction data and recompute totals instead of trusting cached scores.
    const [groupPredData, bracketPredData, matchesData] = await Promise.all([
        fetchAllRows(supabase.from('predictions').select('*')),
        fetchAllRows(supabase.from('live_ko_picks').select('*')),
        fetchAllRows(supabase.from('matches').select('*')),
    ])



    // 3. Fetch group prediction counts per user
    const groupPredCounts = new Map<string, number>()
    for (const row of groupPredData) {
        groupPredCounts.set(row.user_id, (groupPredCounts.get(row.user_id) ?? 0) + 1)
    }

    // 4. Fetch bracket prediction counts per user
    const bracketPredCounts = new Map<string, number>()
    for (const row of bracketPredData) {
        bracketPredCounts.set(row.user_id, (bracketPredCounts.get(row.user_id) ?? 0) + 1)
    }

    const dbFinishedMatches = matchesData
        .filter((m: any) => m.status === 'finished' && m.home_score !== null && m.away_score !== null)

    const apiFinishedMatches = await fetchApiFinishedMatches(matchesData)
    const apiFinishedIds = new Set(apiFinishedMatches.map((m: any) => m.id))
    const effectiveFinishedMatches = [
        ...apiFinishedMatches,
        ...dbFinishedMatches.filter((m: any) => !apiFinishedIds.has(m.id)),
    ]

    const finishedMatches = effectiveFinishedMatches
        .filter((m: any) => m.home_score !== null && m.away_score !== null)
        .sort((a: any, b: any) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())

    const scoresMap = computeFreshScores(
        (allProfiles || []).map(p => p.id),
        finishedMatches,
        groupPredData,
        bracketPredData,
    )

    // 5. Build unified leaderboard with all users
    const leaderboard: LeaderboardUser[] = (allProfiles || []).map(p => {
        const score = scoresMap.get(p.id)
        const groupPreds = groupPredCounts.get(p.id) ?? 0
        const bracketPreds = bracketPredCounts.get(p.id) ?? 0
        return {
            id: p.id,
            display_name: p.display_name ?? 'Player',
            avatar_initials: p.avatar_initials ?? '??',
            avatar_color: p.avatar_color ?? '#555',
            total_points: score?.total_points ?? 0,
            exact_scores: score?.exact_scores ?? 0,
            correct_results: score?.correct_results ?? 0,
            streak: score?.streak ?? 0,
            group_preds: groupPreds,
            bracket_preds: bracketPreds,
            total_preds: groupPreds + bracketPreds,
        }
    })

    const scopeDefinitions = [
        {
            key: 'group-stage',
            type: 'phase' as const,
            title: 'Group Stage',
            short_title: 'GS',
            subtitle: 'All 72 group-stage matches',
            matchTotal: GROUP_TOTAL,
            filter: (match: any) => GROUP_LABELS.includes(match.group_label),
        },
        {
            key: 'knockout',
            type: 'phase' as const,
            title: 'Knockout Phase',
            short_title: 'KO',
            subtitle: 'Round of 32 through the final',
            matchTotal: KNOCKOUT_TOTAL,
            filter: (match: any) => ['R32', 'R16', 'QF', 'SF', '3RD', 'FINAL'].includes(match.group_label),
        },
        {
            key: 'gw1',
            type: 'round' as const,
            title: 'Gameweek 1',
            short_title: 'GW1',
            subtitle: 'Opening group matches',
            matchTotal: 24,
            filter: (match: any) => isGroupWeekMatch(match, 1),
        },
        {
            key: 'gw2',
            type: 'round' as const,
            title: 'Gameweek 2',
            short_title: 'GW2',
            subtitle: 'Second group matches',
            matchTotal: 24,
            filter: (match: any) => isGroupWeekMatch(match, 2),
        },
        {
            key: 'gw3',
            type: 'round' as const,
            title: 'Gameweek 3',
            short_title: 'GW3',
            subtitle: 'Final group matches',
            matchTotal: 24,
            filter: (match: any) => isGroupWeekMatch(match, 3),
        },
        {
            key: 'r32',
            type: 'round' as const,
            title: 'Round of 32',
            short_title: 'R32',
            subtitle: 'First knockout round',
            matchTotal: 16,
            filter: (match: any) => match.group_label === 'R32',
        },
        {
            key: 'r16',
            type: 'round' as const,
            title: 'Round of 16',
            short_title: 'R16',
            subtitle: 'Last sixteen',
            matchTotal: 8,
            filter: (match: any) => match.group_label === 'R16',
        },
        {
            key: 'qf',
            type: 'round' as const,
            title: 'Quarter-finals',
            short_title: 'R8',
            subtitle: 'Last eight',
            matchTotal: 4,
            filter: (match: any) => match.group_label === 'QF',
        },
        {
            key: 'sf',
            type: 'round' as const,
            title: 'Semi-finals',
            short_title: 'R4',
            subtitle: 'Final four',
            matchTotal: 2,
            filter: (match: any) => match.group_label === 'SF',
        },
        {
            key: 'finals',
            type: 'round' as const,
            title: 'Finals Weekend',
            short_title: 'F/3rd',
            subtitle: 'Final and 3rd place',
            matchTotal: 2,
            filter: (match: any) => match.group_label === 'FINAL' || match.group_label === '3RD',
        },
        ...GROUP_LABELS.map(group => ({
            key: `group-${group.toLowerCase()}`,
            type: 'group' as const,
            title: `Group ${group}`,
            short_title: group,
            subtitle: `Tournament Group ${group}`,
            matchTotal: 6,
            filter: (match: any) => match.group_label === group,
        })),
    ]

    const leaderboardScopes = scopeDefinitions.map(scope =>
        buildScopedLeaderboard(
            allProfiles || [],
            finishedMatches,
            groupPredData,
            bracketPredData,
            scope,
        )
    )

    const initials = profile?.avatar_initials ?? 'PL'

    // 6. Fetch non-finished match candidates near/past kickoff. The client
    // verifies external status before applying temporary points, so stale DB
    // rows cannot create fake live labels.
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    const liveMatches = await fetchAllRows(
        supabase.from('matches')
            .select('*')
            .neq('status', 'finished')
            .lte('kickoff', twoHoursFromNow)
    )

    let livePredictions: any[] = []
    if (liveMatches.length > 0) {
        const liveMatchIds = new Set(liveMatches.map((m: any) => m.id))
        const liveGroupPredictions = await fetchAllRows(
            supabase.from('predictions').select('*').in('match_id', Array.from(liveMatchIds))
        )
        const liveBracketPredictions = bracketPredData
            .map(normalizeBracketPickForScoring)
            .filter((p: any) => liveMatchIds.has(p.match_id))

        livePredictions = [...liveGroupPredictions, ...liveBracketPredictions]
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--black)' }}>
            <Nav initials={initials} isGuest={!user} />

            <div style={{ maxWidth: 1000, margin: '0 auto', padding: '100px 5% 60px' }}>
                <div style={{ marginBottom: 40, textAlign: 'center' }}>
                    <h1 style={{ fontFamily: 'Bebas Neue', fontSize: 64, color: 'var(--cream)', letterSpacing: 1, lineHeight: 1 }}>
                        GLOBAL <span style={{ color: 'var(--gold)' }}>LEADERBOARD</span>
                    </h1>
                    <p style={{ color: 'var(--muted)', marginTop: 8 }}>
                        {leaderboard.length} registered predictor{leaderboard.length !== 1 ? 's' : ''} · {TOTAL_MATCHES} matches to predict
                    </p>
                </div>

                <LeaderboardClient
                    initialLeaderboard={leaderboard}
                    leaderboardScopes={leaderboardScopes}
                    initialLiveMatches={liveMatches}
                    initialScoredMatchIds={finishedMatches.map((m: any) => m.id)}
                    livePredictions={livePredictions}
                    currentUserId={user?.id}
                />
            </div>
        </div>
    )
}
