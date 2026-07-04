import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GROUP_MATCHES } from '@/lib/wc2026-data'
import { fetchAllRows } from '@/lib/supabase/pagination'
import { computeFreshScores } from '@/lib/fresh-scores'

const GROUP_MATCH_IDS = new Set(GROUP_MATCHES.map(match => match.id))
const GROUP_MATCH_ID_LIST = GROUP_MATCHES.map(match => match.id)
const GROUP_MATCH_TOTAL = GROUP_MATCHES.length

export async function GET() {
    try {
        const supabase = await createClient()

        const [profiles, predictions, matches] = await Promise.all([
            fetchAllRows(supabase.from('profiles').select('id, display_name, avatar_color').order('created_at', { ascending: true })),
            fetchAllRows(supabase.from('predictions').select('user_id, match_id, home_score, away_score').in('match_id', GROUP_MATCH_ID_LIST)),
            fetchAllRows(supabase.from('matches').select('id, group_label, stage, home_score, away_score, status, kickoff').in('id', GROUP_MATCH_ID_LIST)),
        ])

        const finishedGroupMatches = matches
            .filter((match: any) =>
                GROUP_MATCH_IDS.has(match.id) &&
                match.status === 'finished' &&
                match.home_score !== null &&
                match.away_score !== null
            )
            .sort((a: any, b: any) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())

        const totals = computeFreshScores(
            profiles.map((profile: any) => profile.id),
            finishedGroupMatches,
            predictions,
            [],
        )

        const leaders = profiles
            .map((profile: any) => {
                const score = totals.get(profile.id)
                return {
                    id: profile.id,
                    display_name: profile.display_name ?? 'Player',
                    avatar_color: profile.avatar_color ?? '#555',
                    total_points: score?.total_points ?? 0,
                    exact_scores: score?.exact_scores ?? 0,
                    correct_results: score?.correct_results ?? 0,
                }
            })
            .filter((user: any) => user.total_points > 0 || finishedGroupMatches.length > 0)
            .sort((a: any, b: any) =>
                b.total_points - a.total_points ||
                b.exact_scores - a.exact_scores ||
                b.correct_results - a.correct_results ||
                a.display_name.localeCompare(b.display_name)
            )
            .slice(0, 3)

        return NextResponse.json({
            leaders,
            finished_count: finishedGroupMatches.length,
            match_count: GROUP_MATCH_TOTAL,
        })
    } catch (error) {
        console.error('[group-stage-preview] Failed to build preview', error)
        return NextResponse.json({ leaders: [], finished_count: 0, match_count: GROUP_MATCH_TOTAL }, { status: 500 })
    }
}
