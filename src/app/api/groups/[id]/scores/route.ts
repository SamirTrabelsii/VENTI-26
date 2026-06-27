import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/pagination'
import { computeFreshScores, normalizeBracketPickForScoring } from '@/lib/fresh-scores'
import { scoreMatch } from '@/lib/scoring'
import { GROUP_MATCHES, KNOCKOUT_MATCHES } from '@/lib/wc2026-data'

export const dynamic = 'force-dynamic'

const ALL_MATCHES = [...GROUP_MATCHES, ...KNOCKOUT_MATCHES]
const isKnockout = (groupLabel: string) => ['R32', 'R16', 'QF', 'SF', '3RD', 'FINAL'].includes(groupLabel)

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: group } = await supabase
        .from('groups')
        .select('id')
        .eq('id', id)
        .single()

    if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })

    const members = await fetchAllRows(
        supabase
            .from('group_members')
            .select('user_id, joined_at, profile:profiles(display_name, email, avatar_initials, avatar_color)')
            .eq('group_id', id)
    )

    if (!members.some((m: any) => m.user_id === user.id)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const memberIds = members.map((m: any) => m.user_id)
    if (memberIds.length === 0) {
        return NextResponse.json({ scores: [], member_count: 0, members_preview: [] })
    }

    const [predictions, bracketPicks, scoreRows, finishedMatchesData, liveMatchesData] = await Promise.all([
        fetchAllRows(supabase.from('predictions').select('*').in('user_id', memberIds)),
        fetchAllRows(supabase.from('live_ko_picks').select('*').in('user_id', memberIds)),
        fetchAllRows(supabase.from('scores').select('user_id, bracket_bonus_points').in('user_id', memberIds)),
        fetchAllRows(supabase.from('matches').select('*').eq('status', 'finished')),
        fetchAllRows(
            supabase
                .from('matches')
                .select('*')
                .eq('status', 'live')
        ),
    ])

    const bracketBonusByUser = new Map<string, number>()
    for (const row of scoreRows) {
        const current = bracketBonusByUser.get(row.user_id) ?? 0
        bracketBonusByUser.set(row.user_id, Math.max(current, row.bracket_bonus_points ?? 0))
    }

    const finishedMatches = finishedMatchesData
        .filter((m: any) => m.home_score !== null && m.away_score !== null)
        .sort((a: any, b: any) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())

    const totals = computeFreshScores(
        memberIds,
        finishedMatches,
        predictions,
        bracketPicks,
        bracketBonusByUser,
    )

    let liveApiMatches: any[] = []
    try {
        const liveRes = await fetch(new URL('/api/matches/live', request.url).toString(), {
            cache: 'no-store',
            signal: AbortSignal.timeout(4000),
        })
        if (liveRes.ok) {
            const liveData = await liveRes.json()
            liveApiMatches = liveData.matches ?? []
        }
    } catch {
        liveApiMatches = []
    }

    const liveMatchIds = new Set(liveMatchesData.map((m: any) => m.id))
    const livePredictions = liveMatchesData.length > 0
        ? [
            ...predictions.filter((p: any) => liveMatchIds.has(p.match_id)),
            ...bracketPicks
                .map(normalizeBracketPickForScoring)
                .filter((p: any) => liveMatchIds.has(p.match_id)),
        ]
        : []

    const liveTotalsByUser = new Map<string, { points: number; exact: number; correct: number }>()
    for (const match of liveMatchesData) {
        const staticMatch = ALL_MATCHES.find(m => m.id === match.id)
        if (!staticMatch) continue

        const effHome = match.home_team ?? staticMatch.home_team
        const effAway = match.away_team ?? staticMatch.away_team
        const apiMatch = liveApiMatches.find(l => l.homeTeam?.tla === effHome && l.awayTeam?.tla === effAway)

        if (apiMatch?.status !== 'IN_PLAY' && apiMatch?.status !== 'PAUSED') continue

        const hScore = apiMatch.score?.fullTime?.home
        const aScore = apiMatch.score?.fullTime?.away

        if (typeof hScore !== 'number' || typeof aScore !== 'number') continue

        for (const pred of livePredictions.filter((p: any) => p.match_id === match.id)) {
            const ko = isKnockout(staticMatch.group_label)
            const effPredHome = !pred.is_repredicted && typeof pred.original_home_score === 'number'
                ? pred.original_home_score
                : pred.home_score
            const effPredAway = !pred.is_repredicted && typeof pred.original_away_score === 'number'
                ? pred.original_away_score
                : pred.away_score

            if (typeof effPredHome !== 'number' || typeof effPredAway !== 'number') continue

            const isFixtureCorrect = ko
                ? true
                : !pred.predicted_home_team ||
                    !pred.predicted_away_team ||
                    (pred.predicted_home_team === effHome && pred.predicted_away_team === effAway)

            const result = scoreMatch(effPredHome, effPredAway, hScore, aScore, ko, {
                predQualifier: pred.qualifier_pick || pred.qualifier || pred.team_code,
                realQualifier: match.qualifier || staticMatch.qualifier || null,
                isRepredicted: !!pred.is_repredicted,
                multiplier: match.multiplier || staticMatch.multiplier || 1,
                isFixtureCorrect,
            })

            const current = liveTotalsByUser.get(pred.user_id) ?? { points: 0, exact: 0, correct: 0 }
            current.points += result.total
            if (result.type === 'exact') current.exact += 1
            if (['exact', 'correct', 'goal_diff'].includes(result.type)) current.correct += 1
            liveTotalsByUser.set(pred.user_id, current)
        }
    }

    const scores = members.map((m: any) => {
        const profile = Array.isArray(m.profile) ? m.profile[0] : m.profile
        const total = totals.get(m.user_id)
        const liveTotal = liveTotalsByUser.get(m.user_id) ?? { points: 0, exact: 0, correct: 0 }
        const displayName = profile?.display_name ?? profile?.email ?? 'Player'

        return {
            user_id: m.user_id,
            group_id: id,
            display_name: displayName,
            joined_at: m.joined_at,
            total_points: (total?.total_points ?? 0) + liveTotal.points,
            exact_scores: (total?.exact_scores ?? 0) + liveTotal.exact,
            correct_results: (total?.correct_results ?? 0) + liveTotal.correct,
            streak: total?.streak ?? 0,
            live_bonus: liveTotal.points,
            profile: {
                id: m.user_id,
                email: profile?.email ?? '',
                display_name: displayName,
                avatar_initials: profile?.avatar_initials ?? 'PL',
                avatar_color: profile?.avatar_color ?? '#555',
                created_at: '',
            },
        }
    }).sort((a, b) =>
        b.total_points - a.total_points ||
        a.display_name.localeCompare(b.display_name)
    )

    return NextResponse.json({
        scores,
        member_count: members.length,
        members_preview: scores.slice(0, 5).map(s => ({ display_name: s.display_name })),
    }, {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
    })
}
