'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, LayoutList, Sparkles, Trophy, X, type LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { APP_RELEASE_VERSION } from '@/lib/app-version'
import { getRobohashUrl } from '@/lib/wc2026-data'

type Slide = {
    title: string
    body: string
    Icon: LucideIcon
    accent: string
    variant: 'leaderboard' | 'tabs'
}

type GroupStageLeader = {
    id: string
    display_name: string
    avatar_color: string
    total_points: number
    exact_scores: number
    correct_results: number
}

const STORAGE_PREFIX = 'venti26:whats-new'
const RANKING_TABS = ['Overall', 'Group Stage', 'Knockout', 'Rounds', 'Groups']

export default function WhatsNewCarousel({ isGuest }: { isGuest?: boolean }) {
    const router = useRouter()
    const [supabase] = useState(() => createClient())
    const [visible, setVisible] = useState(false)
    const [storageKey, setStorageKey] = useState<string | null>(null)
    const [userId, setUserId] = useState<string | null>(null)
    const [active, setActive] = useState(0)
    const [leaders, setLeaders] = useState<GroupStageLeader[]>([])
    const [finishedCount, setFinishedCount] = useState(0)
    const [matchCount, setMatchCount] = useState(72)
    const [leadersLoading, setLeadersLoading] = useState(false)
    const [leadersFetched, setLeadersFetched] = useState(false)

    const slides = useMemo<Slide[]>(() => [
        {
            title: 'Group Stage Leaders',
            body: 'Rankings now show who led the group phase, with a dedicated table for group-stage points.',
            Icon: Trophy,
            accent: '#D4A843',
            variant: 'leaderboard',
        },
        {
            title: 'Ranking Tabs',
            body: 'Use the tabs to switch between overall, phases, specific rounds, and tournament groups.',
            Icon: LayoutList,
            accent: '#22C55E',
            variant: 'tabs',
        },
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

    useEffect(() => {
        if (!visible || leadersFetched) return

        let cancelled = false

        async function fetchLeaders() {
            const controller = new AbortController()
            const timeout = window.setTimeout(() => controller.abort(), 5000)
            setLeadersLoading(true)
            try {
                const res = await fetch('/api/leaderboard/group-stage-preview', {
                    cache: 'no-store',
                    signal: controller.signal,
                })
                if (!res.ok) throw new Error('Failed to load group-stage preview')
                const data = await res.json()
                if (cancelled) return
                setLeaders(data.leaders ?? [])
                setFinishedCount(data.finished_count ?? 0)
                setMatchCount(data.match_count ?? 72)
                setLeadersFetched(true)
            } catch {
                if (!cancelled) {
                    setLeaders([])
                    setLeadersFetched(true)
                }
            } finally {
                window.clearTimeout(timeout)
                if (!cancelled) setLeadersLoading(false)
            }
        }

        fetchLeaders()

        return () => {
            cancelled = true
        }
    }, [visible, leadersFetched])

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
            router.push('/leaderboard')
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
                                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#D4A843]">Leaderboard update</p>
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
                                    className="pr-1"
                                >
                                    <div className="mb-4 flex items-center gap-3">
                                        <div className="grid h-12 w-12 place-items-center border bg-black/45" style={{ borderColor: `${slide.accent}88` }}>
                                            <Icon size={24} style={{ color: slide.accent }} />
                                        </div>
                                        <h2 id="whats-new-title" className="font-display text-2xl uppercase leading-tight tracking-wide text-white md:text-3xl">
                                            {slide.title}
                                        </h2>
                                    </div>

                                    <div className="mt-3 space-y-3">
                                        <p className="text-base leading-7 text-zinc-300">{slide.body}</p>

                                        {slide.variant === 'leaderboard' && (
                                            <div className="space-y-2 border border-[#D4A843]/30 bg-[#D4A843]/[0.06] p-4">
                                                <div className="flex items-center justify-between gap-4">
                                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#D4A843]">Group stage ranking</p>
                                                    <p className="font-display text-2xl leading-none text-white">{finishedCount}/{matchCount}</p>
                                                </div>

                                                {leadersLoading ? (
                                                    <p className="py-4 text-sm text-zinc-400">Loading group-stage leaders...</p>
                                                ) : leaders.length > 0 ? (
                                                    leaders.map((user, index) => {
                                                        const color = index === 0 ? '#D4A843' : index === 1 ? '#C0C0C0' : '#CD7F32'
                                                        return (
                                                            <div key={user.id} className="flex items-center gap-3 border border-white/10 bg-black/35 p-2">
                                                                <div className="w-7 text-center font-display text-2xl leading-none" style={{ color }}>{index + 1}</div>
                                                                <img src={getRobohashUrl(user.display_name, 52)} alt={user.display_name} className="h-10 w-10 rounded-full border-2 object-cover" style={{ borderColor: color, background: user.avatar_color }} />
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="truncate text-sm font-black text-white">{user.display_name}</p>
                                                                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">{user.exact_scores} EX / {user.correct_results} CR</p>
                                                                </div>
                                                                <p className="font-display text-3xl leading-none" style={{ color }}>{user.total_points}</p>
                                                            </div>
                                                        )
                                                    })
                                                ) : (
                                                    <p className="py-4 text-sm text-zinc-400">No completed group-stage scores yet.</p>
                                                )}
                                            </div>
                                        )}

                                        {slide.variant === 'tabs' && (
                                            <div className="flex flex-wrap gap-2">
                                                {RANKING_TABS.map(tab => (
                                                    <div key={tab} className="border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-white">
                                                        {tab}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                    </div>
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
