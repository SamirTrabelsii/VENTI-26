'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    Gift,
    Medal,
    Sparkles,
    Swords,
    Target,
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
    variant?: 'scoring' | 'bonus'
}

const STORAGE_PREFIX = 'venti26:whats-new'
const SCORING_HIGHLIGHTS = [
    { points: '+25', title: 'Exact score', detail: 'Hard cap' },
    { points: '+10', title: 'Correct result', detail: 'Win/draw/loss' },
    { points: '+10', title: 'Correct qualifier', detail: 'Right team advances' },
    { points: '+3', title: 'GG / No Goal', detail: 'BTTS or clean sheet' },
]
const SCORING_LADDER = [
    { error: '1', points: '+5' },
    { error: '2', points: '+4' },
    { error: '3', points: '+3' },
    { error: '4', points: '+2' },
    { error: '5', points: '+1' },
    { error: '6+', points: '+0' }
]

const FIRST_R32_KICKOFF = '2026-06-28T18:00:00.000Z'

function formatKickoffLocal(utc: string) {
    const d = new Date(utc)
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) +
        ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export default function WhatsNewCarousel({ isGuest }: { isGuest?: boolean }) {
    const router = useRouter()
    const [supabase] = useState(() => createClient())
    const [visible, setVisible] = useState(false)
    const [storageKey, setStorageKey] = useState<string | null>(null)
    const [userId, setUserId] = useState<string | null>(null)
    const [active, setActive] = useState(0)

    const slides = useMemo<Slide[]>(() => [
        {
            title: 'Knockout Bracket Reset',
            body: 'The original knockout bracket was set up incorrectly. Your old picks won\'t count — but now you can re-predict with real knowledge from the group stage.',
            note: 'تم إعادة تعيين توقعات مرحلة خروج المغلوب بسبب خطأ في الشجرة الأصلية. توقعاتكم السابقة لن تُحتسب — لكن يمكنكم الآن إعادة التوقع بناءً على ما شاهدتموه في دور المجموعات.',
            Icon: AlertTriangle,
            accent: '#F59E0B',
        },
        {
            title: 'Live KO — Your New Arena',
            body: 'Head to the Live KO page to predict every knockout match from R32 to the Final. Predictions open when teams are confirmed, lock at kickoff.',
            note: `⚡ First R32 match: ${formatKickoffLocal(FIRST_R32_KICKOFF)} — don't miss it!`,
            Icon: Swords,
            accent: '#22C55E',
        },
        {
            title: 'KO Scoring',
            body: '',
            note: '',
            Icon: Target,
            accent: '#D4A843',
            variant: 'scoring'
        },
        {
            title: 'Qualification Bonus',
            body: '+1 point for every team you predicted to qualify that actually made it through.',
            note: '',
            Icon: Gift,
            accent: '#A78BFA',
            variant: 'bonus'
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
            router.push('/live-bracket')
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
                                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#D4A843]">Important update</p>
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

                                    {slide.variant === 'scoring' ? (
                                        <div className="mt-3 space-y-2">
                                            <p className="text-[13px] leading-snug text-zinc-300">
                                                Knockout scoring — up to <span className="font-bold text-[#D4A843]">35 pts</span> per match. Exact score is king.
                                            </p>

                                            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                                                {SCORING_HIGHLIGHTS.map(rule => (
                                                    <div key={rule.title} className="border border-white/10 bg-white/[0.04] p-2">
                                                        <p className="font-display text-2xl leading-none text-[#D4A843]">{rule.points}</p>
                                                        <p className="mt-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-white">{rule.title}</p>
                                                        <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-zinc-500">{rule.detail}</p>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="border border-[#D4A843]/25 bg-[#D4A843]/[0.06] p-2">
                                                <div className="mb-1.5 flex items-center justify-between gap-3">
                                                    <div>
                                                        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#D4A843]">Goal accuracy</p>
                                                    </div>
                                                    <div className="font-display text-lg text-white">+5 to +0</div>
                                                </div>
                                                <div className="grid grid-cols-6 gap-1">
                                                    {SCORING_LADDER.map(item => (
                                                        <div key={item.error} className="border border-white/10 bg-black/35 px-0.5 py-1.5 text-center">
                                                            <p className="text-[8px] font-black uppercase tracking-[0.12em] text-zinc-500">Off {item.error}</p>
                                                            <p className="mt-0.5 font-display text-lg text-[#D4A843]">{item.points}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="border border-white/10 bg-black/35 p-2">
                                                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500">Wrong winner</p>
                                                    <p className="font-display text-xl text-white">0 base</p>
                                                </div>
                                                <div className="border border-white/10 bg-black/35 p-2">
                                                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500">Max per KO match</p>
                                                    <p className="font-display text-xl text-[#D4A843]">35</p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : slide.variant === 'bonus' ? (
                                        <div className="mt-3 space-y-3">
                                            <p className="text-base leading-7 text-zinc-300">
                                                {slide.body}
                                            </p>

                                            <div className="border border-[#A78BFA]/30 bg-[#A78BFA]/[0.06] p-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="grid h-14 w-14 flex-shrink-0 place-items-center border border-[#A78BFA]/40 bg-black/40">
                                                        <p className="font-display text-3xl text-[#A78BFA]">+1</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A78BFA]">Per correct qualification</p>
                                                        <p className="mt-1 text-sm leading-snug text-zinc-300">Predicted they qualify → they did → you score.</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-start gap-3 border border-white/10 bg-white/[0.04] p-3">
                                                <Medal size={18} className="mt-0.5 shrink-0 text-[#D4A843]" />
                                                <p className="text-sm leading-6 text-zinc-400">Calculated automatically after groups conclude.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <p className="mt-4 text-base leading-7 text-zinc-300">
                                                {slide.body}
                                            </p>

                                            {slide.note && (
                                                <div className="mt-5 border border-white/10 bg-white/[0.04] p-4" style={{ direction: 'rtl', textAlign: 'right' }}>
                                                    <p className="text-sm leading-7 text-zinc-300">{slide.note}</p>
                                                </div>
                                            )}
                                        </>
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
                                    {active === slides.length - 1 ? 'Let\'s Go' : 'Next'}
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

