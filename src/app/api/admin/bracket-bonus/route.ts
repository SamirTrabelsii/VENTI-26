import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { BRACKET_ROUNDS } from '@/lib/wc2026-data'

export async function POST(request: Request) {
    const supabase = await createClient()

    // Auth guard (check for admin or scoring secret)
    const secret = request.headers.get('x-scoring-secret')
    if (secret !== process.env.SCORING_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // 1. Fetch all finished knockout matches
        const { data: matches, error: matchesErr } = await supabase
            .from('matches')
            .select('id, stage, home_team, away_team, home_score, away_score, qualifier')
            .eq('status', 'finished')

        if (matchesErr || !matches) {
            throw new Error('Failed to fetch matches')
        }

        const knockoutMatches = matches.filter(m => m.stage && !['group', 'group_stage', 'GROUP_STAGE'].includes(m.stage))

        // We determine the set of REAL qualified teams for each round
        // A team is a "Round of 32 qualifier" if they are literally playing in a Round of 32 match!
        // A team is a "Round of 16 qualifier" if they are playing in a Round of 16 match!
        // So we just collect all teams that appear in each stage.
        
        const realQualifiers: Record<string, Set<string>> = {
            r32: new Set(),
            r16: new Set(),
            qf: new Set(),
            sf: new Set(),
            final: new Set(),
            champion: new Set()
        }

        for (const m of knockoutMatches) {
            const [roundStr] = m.id.split('_')
            
            // The teams playing in this round are qualifiers for this round
            if (realQualifiers[roundStr]) {
                if (m.home_team && m.home_team !== 'TBD') realQualifiers[roundStr].add(m.home_team)
                if (m.away_team && m.away_team !== 'TBD') realQualifiers[roundStr].add(m.away_team)
            }
            
            // If this is the final, the winner is the champion
            if (roundStr === 'final') {
                const winner = m.home_score !== null && m.away_score !== null 
                    ? (m.home_score > m.away_score ? m.home_team : (m.away_score > m.home_score ? m.away_team : m.qualifier))
                    : null
                if (winner && winner !== 'TBD') {
                    realQualifiers['champion'].add(winner)
                }
            }
        }

        // 2. Fetch all bracket picks
        const { data: bracketPicks, error: bpErr } = await supabase
            .from('bracket_picks')
            .select('user_id, round, team_code')

        if (bpErr || !bracketPicks) {
            throw new Error('Failed to fetch bracket picks')
        }

        // 3. Calculate bracket bonus points per user
        // Bonuses: r32=1, r16=2, qf=4, sf=8, final=16, champion=32
        const ROUND_MULTIPLIERS: Record<string, number> = {
            r32: 1,
            r16: 2,
            qf: 4,
            sf: 8,
            final: 16,
            champion: 32
        }

        const userBonuses: Record<string, number> = {}

        for (const pick of bracketPicks) {
            if (!userBonuses[pick.user_id]) userBonuses[pick.user_id] = 0

            const round = pick.round
            const team = pick.team_code

            if (team && team !== 'TBD' && realQualifiers[round] && realQualifiers[round].has(team)) {
                userBonuses[pick.user_id] += (ROUND_MULTIPLIERS[round] || 0)
            }
        }

        // 4. Update the scores table for each user
        // Note: In a production app with thousands of users, you should do a bulk upsert or raw SQL query.
        // For Venti26, we'll fetch all scores, update the bracket_bonus_points, and re-sum total_points.
        const { data: scores, error: scoresErr } = await supabase
            .from('scores')
            .select('user_id, group_id, total_points, bracket_bonus_points')
        
        if (scoresErr || !scores) {
            throw new Error('Failed to fetch scores')
        }

        const scoreUpserts = scores.map(score => {
            const newBonus = userBonuses[score.user_id] || 0
            const oldBonus = score.bracket_bonus_points || 0
            
            // Adjust the total points by removing the old bonus and adding the new one
            const newTotal = (score.total_points - oldBonus) + newBonus

            return {
                user_id: score.user_id,
                group_id: score.group_id,
                total_points: newTotal,
                bracket_bonus_points: newBonus
            }
        })

        // Filter out those whose bonus hasn't changed to save DB calls
        const changedScores = scoreUpserts.filter(su => {
            const oldScore = scores.find(s => s.user_id === su.user_id && s.group_id === su.group_id)
            return oldScore && oldScore.bracket_bonus_points !== su.bracket_bonus_points
        })

        if (changedScores.length > 0) {
            const { error: upsertErr } = await supabase
                .from('scores')
                .upsert(changedScores, { onConflict: 'user_id,group_id' })
            
            if (upsertErr) {
                console.error('Failed to update scores:', upsertErr)
                throw new Error('Failed to update scores')
            }
        }

        return NextResponse.json({ 
            message: 'Bracket bonuses calculated successfully', 
            processedUsers: Object.keys(userBonuses).length,
            updatedScoreRows: changedScores.length 
        })

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
