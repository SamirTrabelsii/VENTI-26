'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
    Activity,
    Award,
    BarChart3,
    ChevronLeft,
    ChevronRight,
    Medal,
    Sparkles,
    Target,
    UserRound,
    X,
    type LucideIcon
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { APP_RELEASE_VERSION } from '@/lib/app-version'

type Slide = {
    title: string
    body: string
    note: string
    Icon: LucideIcon
    accent: string
    variant?: 'scoring'
}

const STORAGE_PREFIX = 'venti26:whats-new'
const SCORING_LADDER = [
    { error: '0', points: '+15', label: 'Exact Score' },
    { error: '1', points: '+5', label: '1 Goal Off' },
    { error: '2', points: '+0', label: '2 Goals Off' },
    { error: '3', points: '-5', label: '3 Goals Off' },
    { error: '4', points: '-8', label: '4 Goals Off' },
    { error: '5+', points: '-10', label: '5+ Goals Off' }
]

export default function WhatsNewCarousel({ isGuest }: { isGuest?: boolean }) {
    const [supabase] = useState(() => createClient())
    const [visible, setVisible] = useState(false)
    const [storageKey, setStorageKey] = useState<string | null>(null)
    const [userId, setUserId] = useState<string | null>(null)
    const [active, setActive] = useState(0)

    const slides = useMemo<Slide[]>(() => [
        {
            title: 'New Scoring System',
            body: 'A precise scoring model based on Goal Difference Error. Earn up to 15 points for perfect predictions.',
            note: '',
            Icon: Target,
            accent: '#D4A843',
            variant: 'scoring'
        },
        {
            title: 'Pulse page',
            body: 'A new place to follow tournament KPIs and competition signals.',
            note: 'Quick view of momentum, live context, and key numbers.',
            Icon: Activity,
            accent: '#2DD4BF'
        },
        {
            title: 'Leaderboard improved',
            body: 'Rankings now reflect the new points model more clearly.',
            note: 'Totals are recalculated with the updated formula.',
            Icon: BarChart3,
            accent: '#60A5FA'
        },
        {
            title: 'Profile Page',
            body: 'Your player profile now has a clearer place in the platform.',
            note: 'Follow identity, stats, and your tournament story from one page.',
            Icon: UserRound,
            accent: '#F472B6'
        },
        {
            title: 'Badges & Awards',
            body: 'A new success system is coming to celebrate strong predictions and big moments.',
            note: 'Upcoming awards will highlight exact scores, streaks, leaderboard climbs, and tournament achievements.',
            Icon: Award,
            accent: '#A3E635'
        }
    ], [])

    useEffect(() => {
        let cancelled = false

        async function checkSeenState() {
            if (isGuest) return

            const { data } = await supabase.auth.getUser()
            const currentUserId = data.user?.id
            if (!currentUserId || cancelled) return

            const key = `${STORAGE_PREFIX}:${APP_RELEASE_VERSION}:${currentUserId}`
            setUserId(currentUserId)
            setStorageKey(key)

            if (window.localStorage.getItem(key) === 'seen') {
                setVisible(false)
                return
            }

            const { data: releaseView, error } = await supabase
                .from('user_app_release_views')
                .select('release_version')
                .eq('user_id', currentUserId)
                .eq('release_version', APP_RELEASE_VERSION)
                .maybeSingle()

            if (cancelled) return

            if (releaseView) {
                window.localStorage.setItem(key, 'seen')
                setVisible(false)
                return
            }

            setVisible(Boolean(error) || !releaseView)
        }

        checkSeenState()

        return () => {
            cancelled = true
        }
    }, [isGuest, supabase])

    useEffect(() => {
        if (!visible) return

        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'

        return () => {
            document.body.style.overflow = previousOverflow
        }
    }, [visible])

    const markSeen = () => {
        if (storageKey) {
            window.localStorage.setItem(storageKey, 'seen')
        }

        if (userId) {
            void supabase
                .from('user_app_release_views')
                .upsert(
                    {
                        user_id: userId,
                        release_version: APP_RELEASE_VERSION,
                        seen_at: new Date().toISOString()
                    },
                    { onConflict: 'user_id,release_version' }
                )
        }

        setVisible(false)
    }

    const goNext = () => {
        if (active === slides.length - 1) {
            markSeen()
            return
        }

        setActive(index => index + 1)
    }

    const slide = slides[active]
    const Icon = slide.Icon

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    <motion.section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="whats-new-title"
                        className="relative w-full max-w-[560px] overflow-hidden border border-[#D4A843]/30 bg-[#070707] text-white shadow-[0_24px_80px_rgba(0,0,0,0.7)]"
                        initial={{ opacity: 0, y: 22, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 22, scale: 0.96 }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                    >
                        <div className="absolute inset-0 opacity-25" aria-hidden="true">
                            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:54px_54px]" />
                            <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_50%_0%,rgba(212,168,67,0.35),transparent_65%)]" />
                        </div>

                        <div className="relative p-5 md:p-6">
                            <div className="mb-6 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="grid h-10 w-10 place-items-center border border-[#D4A843]/40 bg-[#D4A843]/10">
                                        <Sparkles size={18} className="text-[#D4A843]" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#D4A843]">Season update</p>
                                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">{active + 1} of {slides.length}</p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={markSeen}
                                    aria-label="Close update announcement"
                                    className="grid h-10 w-10 place-items-center border border-white/10 bg-white/[0.03] text-zinc-400 transition-colors hover:border-[#D4A843]/45 hover:text-[#D4A843]"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="mb-7 flex gap-2">
                                {slides.map((item, index) => (
                                    <button
                                        key={item.title}
                                        type="button"
                                        onClick={() => setActive(index)}
                                        aria-label={`Show update ${index + 1}`}
                                        className="h-1.5 flex-1 overflow-hidden bg-white/10"
                                    >
                                        <span
                                            className="block h-full transition-all duration-200"
                                            style={{
                                                width: index <= active ? '100%' : '0%',
                                                backgroundColor: index <= active ? item.accent : 'transparent'
                                            }}
                                        />
                                    </button>
                                ))}
                            </div>

                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={active}
                                    initial={{ opacity: 0, x: 18 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -18 }}
                                    transition={{ duration: 0.2 }}
                                    className="max-h-[60vh] overflow-y-auto pr-1 md:max-h-[65vh]"
                                    style={{ scrollbarWidth: 'thin' }}
                                >
                                    <div className="mb-4 flex items-center gap-3">
                                        <div className="grid h-12 w-12 place-items-center border bg-black/45" style={{ borderColor: `${slide.accent}88` }}>
                                            <Icon size={24} style={{ color: slide.accent }} />
                                        </div>
                                        <h2 id="whats-new-title" className="font-display text-2xl uppercase leading-tight tracking-wide text-white md:text-3xl">
                                            {slide.title}
                                        </h2>
                                    </div>


                                    {slide.variant !== 'scoring' && (
                                        <p className="mt-4 text-base leading-7 text-zinc-300">
                                            {slide.body}
                                        </p>
                                    )}

                                    {slide.variant === 'scoring' ? (
                                        <div className="mt-4 space-y-3">
                                            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                                                {SCORING_LADDER.map(item => (
                                                    <div key={item.error} className="border border-white/10 bg-black/35 p-2 text-center">
                                                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">Error {item.error}</p>
                                                        <p className="mt-1 font-display text-xl text-[#D4A843]">{item.points}</p>
                                                        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-400">{item.label}</p>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="border border-white/10 bg-white/[0.04] p-3">
                                                <div className="mb-2 flex items-center justify-center gap-2">
                                                    <Target size={14} className="text-[#D4A843]" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Example</span>
                                                </div>
                                                
                                                <div className="flex items-center justify-between text-center gap-2">
                                                    <div className="flex-1 bg-black/50 border border-white/10 p-2 rounded">
                                                        <span className="block text-[9px] text-zinc-500 uppercase font-black tracking-widest">Prediction</span>
                                                        <span className="block text-xl font-display text-white mt-1">3 - 1</span>
                                                    </div>
                                                    <div className="text-zinc-600 font-black text-[10px] uppercase">VS</div>
                                                    <div className="flex-1 bg-black/50 border border-[#D4A843]/30 p-2 rounded">
                                                        <span className="block text-[9px] text-[#D4A843] uppercase font-black tracking-widest">Actual</span>
                                                        <span className="block text-xl font-display text-white mt-1">2 - 1</span>
                                                    </div>
                                                </div>
                                                
                                                <div className="mt-3 bg-black/30 p-2 border border-white/5 rounded flex justify-between items-center">
                                                    <div className="flex flex-col text-left">
                                                        <span className="text-[10px] text-zinc-400 font-bold">1 Goal Error</span>
                                                        <span className="text-sm font-display text-[#D4A843]">+5 pts</span>
                                                    </div>
                                                    <div className="flex flex-col text-right">
                                                        <span className="text-[10px] text-zinc-400 font-bold">Outcome</span>
                                                        <span className="text-sm font-display text-[#D4A843]">+10 pts</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="mt-5 flex items-start gap-3 border border-white/10 bg-white/[0.04] p-4">
                                            <Medal size={18} className="mt-0.5 shrink-0 text-[#D4A843]" />
                                            <p className="text-sm leading-6 text-zinc-300">{slide.note}</p>
                                        </div>
                                    )}
                                </motion.div>
                            </AnimatePresence>

                            <div className="mt-7 flex items-center justify-between border-t border-white/10 pt-5">
                                <button
                                    type="button"
                                    onClick={() => setActive(index => Math.max(0, index - 1))}
                                    disabled={active === 0}
                                    aria-label="Previous update"
                                    className="grid h-11 w-11 place-items-center border border-white/10 bg-white/[0.03] text-zinc-300 transition-colors hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                                >
                                    <ChevronLeft size={19} />
                                </button>

                                <button
                                    type="button"
                                    onClick={goNext}
                                    className="flex h-11 items-center gap-3 bg-[#D4A843] px-5 text-xs font-black uppercase tracking-[0.18em] text-black transition-transform hover:translate-x-0.5"
                                >
                                    {active === slides.length - 1 ? 'Done' : 'Next'}
                                    <ChevronRight size={17} />
                                </button>
                            </div>
                        </div>
                    </motion.section>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
