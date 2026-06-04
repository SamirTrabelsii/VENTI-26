import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const res = await fetch(
            'https://api.football-data.org/v4/competitions/WC/matches?status=LIVE,IN_PLAY,PAUSED,FINISHED,SCHEDULED',
            {
                headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY ?? '' },
                next: { revalidate: 60 }, // cache 60s
            }
        )

        if (!res.ok) {
            // Return mock data during development / before tournament
            return NextResponse.json({ matches: getMockMatches() })
        }

        const data = await res.json()
        return NextResponse.json({ matches: data.matches ?? [] })
    } catch {
        return NextResponse.json({ matches: getMockMatches() })
    }
}

function getMockMatches() {
    return [
        {
            id: 1001,
            utcDate: '2026-06-11T21:00:00Z',
            status: 'IN_PLAY',
            minute: 67,
            stage: 'GROUP_STAGE',
            group: 'GROUP_A',
            homeTeam: { name: 'United States', shortName: 'USA', crest: '', tla: 'USA' },
            awayTeam: { name: 'Panama', shortName: 'PAN', crest: '', tla: 'PAN' },
            score: {
                fullTime: { home: 2, away: 0 },
                halfTime: { home: 1, away: 0 },
            },
            goals: [
                { minute: 23, team: { name: 'United States' }, scorer: { name: 'Pulisic' }, type: 'NORMAL' },
                { minute: 58, team: { name: 'United States' }, scorer: { name: 'Weah' }, type: 'NORMAL' },
            ],
        },
        {
            id: 1002,
            utcDate: '2026-06-12T00:00:00Z',
            status: 'SCHEDULED',
            stage: 'GROUP_STAGE',
            group: 'GROUP_A',
            homeTeam: { name: 'Uzbekistan', shortName: 'UZB', crest: '', tla: 'UZB' },
            awayTeam: { name: 'Bahrain', shortName: 'BHR', crest: '', tla: 'BHR' },
            score: { fullTime: { home: null, away: null }, halfTime: { home: null, away: null } },
            goals: [],
        },
        {
            id: 1003,
            utcDate: '2026-06-12T21:00:00Z',
            status: 'SCHEDULED',
            stage: 'GROUP_STAGE',
            group: 'GROUP_B',
            homeTeam: { name: 'Argentina', shortName: 'ARG', crest: '', tla: 'ARG' },
            awayTeam: { name: 'Chile', shortName: 'CHI', crest: '', tla: 'CHI' },
            score: { fullTime: { home: null, away: null }, halfTime: { home: null, away: null } },
            goals: [],
        },
        {
            id: 1004,
            utcDate: '2026-06-14T21:00:00Z',
            status: 'FINISHED',
            stage: 'GROUP_STAGE',
            group: 'GROUP_D',
            homeTeam: { name: 'France', shortName: 'FRA', crest: '', tla: 'FRA' },
            awayTeam: { name: 'Italy', shortName: 'ITA', crest: '', tla: 'ITA' },
            score: { fullTime: { home: 3, away: 1 }, halfTime: { home: 1, away: 1 } },
            goals: [
                { minute: 12, team: { name: 'France' }, scorer: { name: 'Mbappé' }, type: 'NORMAL' },
                { minute: 34, team: { name: 'Italy' }, scorer: { name: 'Barella' }, type: 'NORMAL' },
                { minute: 61, team: { name: 'France' }, scorer: { name: 'Griezmann' }, type: 'NORMAL' },
                { minute: 88, team: { name: 'France' }, scorer: { name: 'Dembélé' }, type: 'NORMAL' },
            ],
        },
        {
            id: 1005,
            utcDate: '2026-06-15T21:00:00Z',
            status: 'SCHEDULED',
            stage: 'GROUP_STAGE',
            group: 'GROUP_E',
            homeTeam: { name: 'Spain', shortName: 'ESP', crest: '', tla: 'ESP' },
            awayTeam: { name: 'Japan', shortName: 'JPN', crest: '', tla: 'JPN' },
            score: { fullTime: { home: null, away: null }, halfTime: { home: null, away: null } },
            goals: [],
        },
        {
            id: 1006,
            utcDate: '2026-06-16T00:00:00Z',
            status: 'SCHEDULED',
            stage: 'GROUP_STAGE',
            group: 'GROUP_E',
            homeTeam: { name: 'Brazil', shortName: 'BRA', crest: '', tla: 'BRA' },
            awayTeam: { name: 'Saudi Arabia', shortName: 'KSA', crest: '', tla: 'KSA' },
            score: { fullTime: { home: null, away: null }, halfTime: { home: null, away: null } },
            goals: [],
        },
    ]
}