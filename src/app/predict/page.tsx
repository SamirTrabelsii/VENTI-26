import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Nav from '@/components/Nav'
import GroupPredictions from '@/components/GroupPredictions'
import ThirdPlaceTable from '@/components/ThirdPlaceTable'
import LockBanner from '@/components/LockBanner'
import HowToPlay from '@/components/HowToPlay'
import BracketSection from '@/components/BracketSection'
import { PredictionProvider } from '@/components/PredictionContext'
import { GROUPS, GROUP_MATCHES, getGroupMatches, getFlagUrl } from '@/lib/wc2026-data'
import TeamFlag from '@/components/TeamFlag'

export default async function PredictPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/login')

    // ── Parallel DB fetch ─────────────────────────────────────────────────────
    const [
        { data: profile },
        { data: predictions },
        { data: bracketPicks },
    ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('predictions').select('*').eq('user_id', user.id),
        supabase.from('bracket_picks').select('*').eq('user_id', user.id),
    ])

    const predMap = new Map(predictions?.map(p => [p.match_id, p]) ?? [])

    const groupProgress = GROUPS.map(g => {
        const matches = getGroupMatches(g)
        return {
            g,
            total: matches.length,
            done: matches.filter(m => predMap.has(m.id)).length,
            flagUrl: getFlagUrl(matches[0]?.home_team ?? ''),
        }
    })

    return (
        <div style={{ minHeight: '100vh', background: 'var(--black)' }}>
            <Nav initials={profile?.avatar_initials ?? 'PL'} />

            <div style={{ display: 'flex', paddingTop: 64, minHeight: '100vh' }}>
                {/* Sticky Sidebar Navigation */}
                <aside
                    className="hidden lg:block"
                    style={{
                        width: 230,
                        flexShrink: 0,
                        position: 'sticky',
                        top: 64,
                        height: 'calc(100vh - 64px)',
                        overflowY: 'auto',
                        background: 'var(--surface)',
                        borderRight: '1px solid var(--border)',
                        padding: '24px 0',
                    }}
                >
                    <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', padding: '0 18px', marginBottom: 8 }}>
                        Navigation
                    </p>
                    <a href="#group-stage" style={{ display: 'block', padding: '10px 18px', fontSize: 13, fontWeight: 500, color: 'var(--cream)', textDecoration: 'none' }}>
                        📅 Group Stage
                    </a>
                    <a href="#third-place" style={{ display: 'block', padding: '10px 18px', fontSize: 13, fontWeight: 500, color: 'var(--cream)', textDecoration: 'none' }}>
                        🏅 3rd Place Ranking
                    </a>
                    <a href="#knockout" style={{ display: 'block', padding: '10px 18px', fontSize: 13, fontWeight: 500, color: 'var(--cream)', textDecoration: 'none' }}>
                        🏟️ Knockout Bracket
                    </a>
                    
                    <div style={{ height: 1, background: 'var(--border)', margin: '14px 18px' }} />
                    
                    <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', padding: '0 18px', marginBottom: 8 }}>
                        Groups Quick Links
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 18px' }}>
                        {groupProgress.map(({ g }) => (
                            <a key={g} href={`#group-${g}`} style={{
                                width: 28, height: 28, borderRadius: 6, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: 'var(--dim)', textDecoration: 'none'
                            }}>
                                {g}
                            </a>
                        ))}
                    </div>
                </aside>

                <div className="flex-1 flex flex-col min-w-0">
                    {/* Mobile Quick Nav */}
                    <div className="lg:hidden sticky top-16 z-40 bg-black/90 backdrop-blur-md border-b border-[var(--border)] px-4 py-3 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                        {groupProgress.map(({ g }) => (
                            <a key={g} href={`#group-${g}`} className="flex-shrink-0 w-10 h-10 rounded-lg bg-surface2 border border-[var(--border)] flex items-center justify-center text-sm font-semibold text-dim no-underline">
                                {g}
                            </a>
                        ))}
                        <a href="#third-place" className="flex-shrink-0 px-4 h-10 rounded-lg bg-surface2 border border-[var(--border)] flex items-center justify-center text-sm font-semibold text-dim no-underline">
                            3rd Place
                        </a>
                        <a href="#knockout" className="flex-shrink-0 px-4 h-10 rounded-lg bg-surface2 border border-[var(--border)] flex items-center justify-center text-sm font-semibold text-dim no-underline">
                            Bracket
                        </a>
                    </div>

                    {/* Main Content */}
                    <main className="flex-1 min-w-0 p-4 pb-24 md:p-8 md:pb-8">
                    <PredictionProvider
                        userId={user.id}
                        initialPredictions={predictions || []}
                        initialBracketPicks={bracketPicks || []}
                    >
                        <div style={{ width: '100%', maxWidth: 800, margin: '0 auto' }}>
                            <LockBanner />
                            <HowToPlay />
                        </div>

                        <div style={{ width: '100%' }}>
                        
                        {/* 1. Group Stage */}
                        <div id="group-stage" style={{ marginBottom: 40, maxWidth: 800, margin: '0 auto' }}>
                            <h1 style={{ fontFamily: 'Bebas Neue', fontSize: 44, color: 'var(--gold)', marginBottom: 20 }}>Group Stage Predictions</h1>
                            {GROUPS.map((g) => {
                                const activeMatches = getGroupMatches(g)
                                return (
                                    <div id={`group-${g}`} key={g} style={{ marginBottom: 60, paddingBottom: 40, borderBottom: '1px solid var(--border)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
                                            <TeamFlag teamCode={activeMatches[0]?.home_team ?? ''} size={60} />
                                            <div>
                                                <h2 style={{ fontFamily: 'Bebas Neue', fontSize: 32, lineHeight: 1 }}>Group {g}</h2>
                                            </div>
                                        </div>
                                        <GroupPredictions
                                            activeMatches={activeMatches}
                                            predictions={predictions || []}
                                            userId={user.id}
                                            nextGroup={null}
                                        />
                                    </div>
                                )
                            })}
                        </div>

                        {/* 2. Third Place Table */}
                        <div id="third-place" style={{ marginBottom: 80, maxWidth: 800, margin: '0 auto' }}>
                            <h1 style={{ fontFamily: 'Bebas Neue', fontSize: 44, color: 'var(--gold)', marginBottom: 20 }}>3rd Place Standings</h1>
                            <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 20 }}>The top 8 third-placed teams across all 12 groups advance to the Round of 32.</p>
                            <ThirdPlaceTable 
                                predictions={predictions || []}
                                groupMatches={GROUP_MATCHES} 
                            />
                        </div>

                        {/* 3. Knockout Bracket */}
                        <div id="knockout" style={{ marginBottom: 80 }}>
                            <h1 style={{ fontFamily: 'Bebas Neue', fontSize: 44, color: 'var(--gold)', marginBottom: 20 }}>Knockout Bracket</h1>
                            <BracketSection />
                        </div>
                        </div>
                    </PredictionProvider>
                </main>
                </div>
            </div>
        </div>
    )
}