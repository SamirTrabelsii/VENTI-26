export interface Profile {
    id: string
    email: string
    display_name: string
    avatar_initials: string
    avatar_color: string
    created_at: string
}

export interface Group {
    id: string
    name: string
    description: string | null
    invite_code: string
    created_by: string
    created_at: string
    member_count?: number
}

export interface GroupMember {
    group_id: string
    user_id: string
    joined_at: string
    profile?: Profile
}

export interface Prediction {
    id: string
    user_id: string
    match_id: string
    home_score: number
    away_score: number
    created_at: string
    updated_at: string
}

export interface BracketPick {
    id: string
    user_id: string
    round: string
    slot_index: number
    team_code: string
    home_score?: number | null
    away_score?: number | null
    created_at: string
}

export interface Score {
    user_id: string
    group_id: string
    total_points: number
    exact_scores: number
    correct_results: number
    streak: number
    rank?: number
    profile?: Profile
}

export interface Match {
    id: string
    group_label: string
    match_number: number
    home_team: string
    away_team: string
    home_flag: string
    away_flag: string
    home_score: number | null
    away_score: number | null
    kickoff: string
    venue: string
    city: string
    status: 'upcoming' | 'live' | 'finished'
    minute?: number
}

export interface Team {
    code: string
    name: string
    flag: string
    fifa_rank: number
    group: string
}

export interface Achievement {
    id: string
    label: string
    description: string
    icon: string
    unlocked: boolean
}