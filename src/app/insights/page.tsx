import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Nav from '@/components/Nav'
import { ACHIEVEMENTS } from '@/lib/wc2026-data'

export default async function InsightsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/login')

    const { data: profile } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()

    const { count: predCount } = await supabase
        .from('predictions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

    // For now, achievements are rule-based stubs
    // In production you'd compute these from actual scores
    const unlockedIds = new Set(['globe_trotter'])
    if ((predCount ?? 0) >= 48) unlockedIds.add('globe_trotter')

    const achievements = ACHIEVEMENTS.map(a => ({
        ...a,
        unlocked: unlockedIds.has(a.id),
    }))

    return (
        <div className="min-h-screen" style={{ background: 'var(--black)' }}>
            <Nav initials={profile?.avatar_initials ?? 'PL'} />

            <div className="max-w-5xl mx-auto px-10 pt-24 pb-16">
                <p className="text-xs font-medium tracking-widest uppercase text-gold mb-2">Football Intelligence</p>
                <h1 className="font-display text-6xl text-cream mb-3">INSIGHTS &amp; STATS</h1>
                <p className="text-sm mb-10" style={{ color: 'var(--dim)' }}>
                    Your prediction style, achievements, and community trends.
                </p>

                {/* Stats overview */}
                <div className="grid grid-cols-3 gap-5 mb-10">
                    {[
                        { label: 'Predictions Made', value: predCount ?? 0, icon: '⚽' },
                        { label: 'Achievements', value: `${achievements.filter(a => a.unlocked).length} / ${achievements.length}`, icon: '🏅' },
                        { label: 'Accuracy', value: '—', icon: '🎯' },
                    ].map(s => (
                        <div key={s.label} className="rounded-2xl p-6 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                            <div className="text-3xl mb-2">{s.icon}</div>
                            <div className="font-display text-4xl text-gold mb-1">{s.value}</div>
                            <div className="text-xs tracking-widest uppercase" style={{ color: 'var(--muted)' }}>{s.label}</div>
                        </div>
                    ))}
                </div>

                {/* Achievements gallery */}
                <div className="rounded-2xl overflow-hidden mb-8" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
                        <span className="text-xs font-semibold tracking-widest uppercase">Achievement Gallery</span>
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>
                            {achievements.filter(a => a.unlocked).length} / {achievements.length} unlocked
                        </span>
                    </div>
                    <div className="grid grid-cols-6 gap-4 p-6">
                        {achievements.map(a => (
                            <div
                                key={a.id}
                                className="flex flex-col items-center gap-2 cursor-pointer transition-transform hover:scale-105"
                                title={a.description}
                            >
                                <div
                                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                                    style={{
                                        background: a.unlocked ? 'rgba(212,168,67,0.12)' : 'var(--surface2)',
                                        border: a.unlocked ? '1px solid var(--border-gold)' : '1px solid var(--border)',
                                        filter: a.unlocked ? 'none' : 'grayscale(1)',
                                        opacity: a.unlocked ? 1 : 0.5,
                                    }}
                                >
                                    {a.icon}
                                </div>
                                <span
                                    className="text-xs text-center leading-tight"
                                    style={{ color: a.unlocked ? 'var(--cream)' : 'var(--muted)' }}
                                >
                                    {a.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Prediction tip */}
                <div
                    className="rounded-2xl p-6"
                    style={{
                        background: 'rgba(212,168,67,0.06)',
                        border: '1px solid var(--border-gold)',
                    }}
                >
                    <p className="text-gold text-sm font-medium mb-2">💡 Prediction tip</p>
                    <p className="text-sm" style={{ color: 'var(--dim)' }}>
                        Exact score predictions are worth 3× more than correct result predictions.
                        Bold picks against the community pay off most when a surprise occurs.
                        Lock predictions early to earn bonus points!
                    </p>
                </div>
            </div>
        </div>
    )
}