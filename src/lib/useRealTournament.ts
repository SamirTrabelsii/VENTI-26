'use client'
import { useState, useEffect } from 'react'

export interface RealTournamentState {
    // Array of team_codes in order (1st to 4th) for each group
    groupStandings: Record<string, string[]>
    // Array of team_codes for 3rd place teams, sorted by ranking
    thirdPlaceRanking: string[]
    // Record of match_id to actual advancing team_code
    knockoutResults: Record<string, string>
}

/**
 * Hook to simulate fetching the real-world tournament standings from Football-Data.org.
 * Since the World Cup hasn't started, everything currently resolves to "TBD".
 * In the future, this will ping /api/matches/live and compute actual rankings.
 */
export function useRealTournament() {
    const [realState, setRealState] = useState<RealTournamentState>({
        groupStandings: {},
        thirdPlaceRanking: [],
        knockoutResults: {}
    })

    useEffect(() => {
        // Mocking the real-world results as empty/TBD for now.
        // When integrating the real API, we will fetch /api/matches/live
        // and calculate the standings here.
        const mockStandings: Record<string, string[]> = {}
        const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
        
        groups.forEach(g => {
            mockStandings[g] = ['TBD', 'TBD', 'TBD', 'TBD']
        })

        setRealState({
            groupStandings: mockStandings,
            thirdPlaceRanking: Array(12).fill('TBD'),
            knockoutResults: {}
        })
    }, [])

    return realState
}
