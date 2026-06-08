'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ActivityItem {
    id: string
    type: 'prediction' | 'join' | 'badge' | 'bracket'
    user_name: string
    user_initials: string
    user_color: string
    message: string
    detail?: string
    icon: string
    icon_bg: string
    timestamp: string
}

interface Props {
    groupId?: string
    userId: string
}

// We build a live activity feed by subscribing to predictions in realtime
// and merging with recent static history fetched on mount
export default function ActivityFeed({ groupId, userId }: Props) {
    const [items, setItems] = useState<ActivityItem[]>([])
    const [supabase] = useState(() => createClient())

    useEffect(() => {
        // Load recent predictions as activity
        const load = async () => {
            const query = supabase
                .from('predictions')
                .select(`
          id,
          match_id,
          home_score,
          away_score,
          updated_at,
          profile:profiles(display_name, avatar_initials, avatar_color)
        `)
                .order('updated_at', { ascending: false })
                .limit(10)

            const { data } = await query

            if (!data) return

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mapped: ActivityItem[] = data.map((p: any) => {
                const profile = Array.isArray(p.profile) ? p.profile[0] : p.profile
                const isMe = p.user_id === userId
                return {
                    id: p.id,
                    type: 'prediction',
                    user_name: isMe ? 'You' : (profile?.display_name ?? 'Someone'),
                    user_initials: profile?.avatar_initials ?? '??',
                    user_color: profile?.avatar_color ?? 'var(--surface3)',
                    message: `predicted match ${p.match_id}`,
                    detail: `${p.home_score} – ${p.away_score}`,
                    icon: '⚽',
                    icon_bg: 'rgba(255,255,255,0.04)',
                    timestamp: timeAgo(p.updated_at),
                }
            })

            setItems(mapped)
        }

        load()

        // Realtime subscription — new predictions push to top of feed
        const channel = supabase
            .channel('activity-feed')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'predictions' },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                async (payload: any) => {
                    const record = payload.new
                    if (!record) return

                    // Fetch the profile for the user who made this prediction
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('display_name, avatar_initials, avatar_color')
                        .eq('id', record.user_id)
                        .single()

                    const isMe = record.user_id === userId
                    const newItem: ActivityItem = {
                        id: record.id,
                        type: 'prediction',
                        user_name: isMe ? 'You' : (profile?.display_name ?? 'Someone'),
                        user_initials: profile?.avatar_initials ?? '??',
                        user_color: profile?.avatar_color ?? 'var(--surface3)',
                        message: `just predicted match ${record.match_id}`,
                        detail: `${record.home_score} – ${record.away_score}`,
                        icon: '⚽',
                        icon_bg: 'rgba(255,255,255,0.04)',
                        timestamp: 'Just now',
                    }

                    setItems(prev => [newItem, ...prev.slice(0, 9)])
                }
            )
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [groupId, userId, supabase])

    if (items.length === 0) {
        return (
            <div className="py-10 text-center">
                <p className="text-3xl mb-2">💬</p>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                    No activity yet. Be the first to predict!
                </p>
            </div>
        )
    }

    return (
        <div>
            {items.map(item => (
                <div
                    key={item.id}
                    className="flex items-start gap-3 px-5 py-4"
                    style={{ borderBottom: '1px solid var(--border)' }}
                >
                    {/* Avatar */}
                    <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                        style={{
                            background: item.user_color,
                            color: 'var(--cream)',
                        }}
                    >
                        {item.user_initials}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm leading-snug" style={{ color: 'var(--dim)' }}>
                            <strong style={{ color: 'var(--cream)', fontWeight: 600 }}>
                                {item.user_name}
                            </strong>{' '}
                            {item.message}
                            {item.detail && (
                                <span
                                    className="ml-1 font-mono text-xs"
                                    style={{ color: 'var(--gold)' }}
                                >
                                    {item.detail}
                                </span>
                            )}
                        </p>
                        <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                            {item.timestamp}
                        </p>
                    </div>

                    {/* Icon */}
                    <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                        style={{ background: item.icon_bg }}
                    >
                        {item.icon}
                    </div>
                </div>
            ))}
        </div>
    )
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
}