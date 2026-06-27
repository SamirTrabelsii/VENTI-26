import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { GET as getLiveMatches } from '@/app/api/matches/live/route'
import {
    buildLiveBracketFixtures,
    fixtureIdFromRoundSlot,
    isKnownTeamCode,
    roundSlotFromFixtureId,
} from '@/lib/live-bracket'
import { KNOCKOUT_MATCHES } from '@/lib/wc2026-data'

export const dynamic = 'force-dynamic'

function badRequest(error: string, status = 400) {
    return NextResponse.json({ error }, { status })
}

export async function POST(request: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return badRequest('You must sign in to save a live bracket prediction.', 401)

    const body = await request.json().catch(() => null)
    const fixtureId = body?.fixtureId
    const homeScore = body?.homeScore
    const awayScore = body?.awayScore
    const advancingTeam = body?.advancingTeam

    if (typeof fixtureId !== 'string') return badRequest('Missing fixture id.')
    if (typeof homeScore !== 'number' || typeof awayScore !== 'number') {
        return badRequest('Enter both scores before saving.')
    }
    if (homeScore < 0 || awayScore < 0 || homeScore > 20 || awayScore > 20) {
        return badRequest('Scores must be between 0 and 20.')
    }

    const staticFixture = KNOCKOUT_MATCHES.find(match => match.id === fixtureId)
    if (!staticFixture) return badRequest('Unknown knockout fixture.')

    const dbMatches = await supabase
        .from('matches')
        .select('id, home_team, away_team, home_score, away_score, kickoff, status, qualifier')

    if (dbMatches.error) return badRequest(dbMatches.error.message, 500)

    let apiMatches: any[] = []
    try {
        const liveRes = await getLiveMatches()
        const liveData = await liveRes.json()
        apiMatches = liveData.matches || []
    } catch {
        apiMatches = []
    }

    const fixture = buildLiveBracketFixtures(apiMatches, dbMatches.data || []).find(match => match.id === fixtureId)
    if (!fixture) return badRequest('Fixture is not available.')
    if (!isKnownTeamCode(fixture.homeCode) || !isKnownTeamCode(fixture.awayCode)) {
        return badRequest('This knockout fixture is not available yet.')
    }

    const kickoff = new Date(fixture.kickoff).getTime()
    const lockAt = kickoff - 15 * 60 * 1000
    if (Date.now() >= lockAt) return badRequest('This match is locked.')

    const validAdvancingTeam = advancingTeam === fixture.homeCode || advancingTeam === fixture.awayCode
    if (homeScore === awayScore && !validAdvancingTeam) {
        return badRequest('Choose who advances on penalties.')
    }

    const teamCode = homeScore > awayScore
        ? fixture.homeCode
        : awayScore > homeScore
            ? fixture.awayCode
            : advancingTeam

    const { round, slotIndex } = roundSlotFromFixtureId(fixture.id)
    if (fixtureIdFromRoundSlot(round, slotIndex) !== fixture.id) {
        return badRequest('Fixture slot mismatch.')
    }

    const admin = createAdminClient()
    await admin
        .from('matches')
        .update({
            home_team: fixture.homeCode,
            away_team: fixture.awayCode,
            kickoff: fixture.kickoff,
        })
        .eq('id', fixture.id)

    const upsertRow = {
        user_id: user.id,
        round,
        slot_index: slotIndex,
        team_code: teamCode,
        home_score: homeScore,
        away_score: awayScore,
        predicted_home_team: fixture.homeCode,
        predicted_away_team: fixture.awayCode,
    }

    const { error } = await admin
        .from('live_ko_picks')
        .upsert(upsertRow, { onConflict: 'user_id,round,slot_index' })

    if (error) return badRequest(error.message, 500)

    const { data: pick, error: readError } = await admin
        .from('live_ko_picks')
        .select('*')
        .eq('user_id', user.id)
        .eq('round', round)
        .eq('slot_index', slotIndex)
        .single()

    if (readError) return badRequest(readError.message, 500)

    return NextResponse.json({ success: true, pick })
}
