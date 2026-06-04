import type { Score } from '@/types'

interface Props {
    scores: Score[]
    currentUserId: string
}

const RANK_COLORS = ['#d4a843', '#b0b8c8', '#cd7f32']

export default function Leaderboard({ scores, currentUserId }: Props) {
    return (
        <div>
            {scores.map((s, i) => {
                const isMe = s.user_id === currentUserId
                const rankColor = i < 3 ? RANK_COLORS[i] : 'var(--muted)'
                const initials = s.profile?.avatar_initials ?? '??'

                return (
                    <div
                        key={s.user_id}
                        className="flex items-center gap-3 px-5 py-3 transition-colors"
                        style={{
                            borderBottom: '1px solid var(--border)',
                            background: isMe ? 'rgba(212,168,67,0.04)' : 'transparent',
                        }}
                    >
                        {/* Rank */}
                        <span
                            className="font-display text-xl w-8 text-center flex-shrink-0"
                            style={{ color: rankColor }}
                        >
                            {i + 1}
                        </span>

                        {/* Avatar */}
                        <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{
                                background: s.profile?.avatar_color ?? 'var(--surface3)',
                                color: 'var(--cream)',
                            }}
                        >
                            {initials}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                                {s.profile?.display_name ?? 'Player'}
                                {isMe && <span className="ml-1 text-xs" style={{ color: 'var(--gold)' }}>👈 You</span>}
                            </div>
                            <div className="text-xs" style={{ color: 'var(--muted)' }}>
                                {s.exact_scores} exact · {s.correct_results} correct
                            </div>
                        </div>

                        {/* Points */}
                        <div className="text-right flex-shrink-0">
                            <div
                                className="font-display text-2xl"
                                style={{ color: isMe ? 'var(--gold)' : 'var(--cream)' }}
                            >
                                {s.total_points}
                            </div>
                            <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--muted)' }}>pts</div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}