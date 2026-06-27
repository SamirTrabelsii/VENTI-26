'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useState, useRef, useEffect } from 'react'
import { getRobohashUrl } from '@/lib/wc2026-data'
import { Home, CalendarDays, Edit3, Users, Trophy, Globe, LogOut, User, GitBranch } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import WhatsNewCarousel from '@/components/WhatsNewCarousel'

const TABS = [
    { href: '/home', label: 'Home', icon: Home },
    { href: '/fixtures', label: 'Fixtures', icon: CalendarDays },
    { href: '/predict', label: 'Predict', icon: Edit3 },
    { href: '/live-bracket', label: 'Live KO', icon: GitBranch },
    { href: '/groups', label: 'Groups', icon: Users },
    { href: '/leaderboard', label: 'Rankings', icon: Trophy },
    { href: '/pulse', label: 'Pulse', icon: Globe }
]

export default function Nav({ initials = 'PL', displayName, isGuest }: { initials?: string; displayName?: string; isGuest?: boolean }) {
    const pathname = usePathname()
    const router = useRouter()
    const [supabase] = useState(() => createClient())
    const [menuOpen, setMenuOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.push('/auth/login')
        router.refresh()
    }

    const avatarSeed = displayName || initials || 'player'

    // Close dropdown on outside click
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setMenuOpen(false)
            }
        }
        if (menuOpen) document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [menuOpen])

    return (
        <>
            {/* Top Navigation - Black & Gold Theme */}
            <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 md:px-8 h-[72px] bg-[#050505]/95 backdrop-blur-md transition-all duration-300">
                {/* Subtle Gold Bottom Gradient Line */}
                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--gold)]/50 to-transparent" />

                {/* Logo */}
                <div
                    className="cursor-pointer flex items-center group relative"
                    onClick={() => router.push('/home')}
                >
                    <div className="relative w-[42px] h-[42px] transition-transform duration-500 group-hover:scale-110">
                        <img
                            src="/images/logo.png"
                            alt="FIFA World Cup 2026"
                            className="object-contain w-full h-full drop-shadow-[0_0_12px_rgba(212,168,67,0.4)]"
                        />
                    </div>
                    <span className="font-display text-[22px] tracking-[0.25em] text-white ml-3 hidden sm:block transition-all duration-500 group-hover:text-[var(--gold)] group-hover:drop-shadow-[0_0_8px_rgba(212,168,67,0.5)]">
                        VENTI<span className="text-white/30 group-hover:text-[var(--gold)]/50">·</span>26
                    </span>
                </div>

                {/* Desktop Tabs - Underline Indicator Style */}
                <div className="hidden md:flex items-center h-full gap-2">
                    {TABS.map(tab => {
                        const active = pathname.startsWith(tab.href)

                        return (
                            <button
                                key={tab.href}
                                onClick={() => router.push(tab.href)}
                                className={`relative h-full px-4 flex items-center gap-2 text-[13px] uppercase tracking-widest font-bold transition-colors duration-300 ${
                                    active ? 'text-[var(--gold)]' : 'text-zinc-500 hover:text-zinc-200'
                                }`}
                            >
                                <tab.icon size={16} className={active ? "text-[var(--gold)] drop-shadow-[0_0_5px_rgba(212,168,67,0.5)]" : "opacity-60"} strokeWidth={active ? 2.5 : 2} />
                                {tab.label}
                                
                                {active && (
                                    <motion.div
                                        layoutId="desktop-nav-line"
                                        className="absolute bottom-0 left-0 right-0 h-[3px] bg-[var(--gold)] shadow-[0_-2px_10px_rgba(212,168,67,0.6)]"
                                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    />
                                )}
                            </button>
                        )
                    })}
                </div>

                {/* Avatar / Sign In */}
                {isGuest ? (
                    <button
                        onClick={() => router.push('/auth/login')}
                        className="px-6 py-2 border border-[var(--gold)] bg-black/50 text-[var(--gold)] text-xs uppercase tracking-widest font-bold hover:bg-[var(--gold)] hover:text-black transition-all duration-300"
                    >
                        Sign In
                    </button>
                ) : (
                    <div className="relative flex items-center h-full" ref={dropdownRef}>
                        <button 
                            className="relative w-[42px] h-[42px] rounded-full overflow-hidden border-[2px] border-[#222] transition-all duration-300 hover:border-[var(--gold)] hover:shadow-[0_0_15px_rgba(212,168,67,0.3)] focus:outline-none"
                            onClick={() => setMenuOpen(v => !v)}
                        >
                            <img
                                src={getRobohashUrl(avatarSeed, 80)}
                                alt="User avatar"
                                className="object-cover w-full h-full bg-[#111]"
                            />
                        </button>

                        {/* Dropdown - Edgy Sports Look */}
                        <AnimatePresence>
                            {menuOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 15, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 15, scale: 0.95 }}
                                    transition={{ duration: 0.2, ease: "easeOut" }}
                                    className="absolute right-0 top-[65px] w-56 bg-[#0a0a0a] border border-[#222] shadow-[0_15px_40px_rgba(0,0,0,0.8)] overflow-hidden"
                                    style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%)' }}
                                >
                                    <div className="px-5 py-4 border-b border-[#222] bg-[#111]">
                                        <p className="text-[10px] text-zinc-500 font-bold mb-1 uppercase tracking-[0.2em]">Signed in as</p>
                                        <p className="text-sm text-white font-display tracking-wide truncate">{displayName || 'Player'}</p>
                                    </div>
                                    <div className="p-2">
                                        <button
                                            onClick={() => {
                                                setMenuOpen(false)
                                                router.push('/profile')
                                            }}
                                            className="w-full px-4 py-3 flex items-center gap-3 text-xs uppercase tracking-wider font-bold text-zinc-300 hover:bg-[#1a1a1a] hover:text-[var(--gold)] transition-colors"
                                        >
                                            <User size={16} />
                                            My Profile
                                        </button>
                                        <button
                                            onClick={handleSignOut}
                                            className="w-full px-4 py-3 flex items-center gap-3 text-xs uppercase tracking-wider font-bold text-zinc-500 hover:bg-red-950/30 hover:text-red-500 transition-colors"
                                        >
                                            <LogOut size={16} />
                                            Sign out
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </nav>

            {/* Mobile Bottom Navigation - Premium Minimalist */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#000000]/60 backdrop-blur-[40px] border-t border-white/[0.04] pb-[env(safe-area-inset-bottom)]">
                <div className="flex items-center h-[70px] px-2 relative">
                    {TABS.map(tab => {
                        const active = pathname.startsWith(tab.href)
                        const Icon = tab.icon

                        return (
                            <button
                                key={tab.href}
                                onClick={() => router.push(tab.href)}
                                className="relative flex-1 flex flex-col items-center justify-center h-full focus:outline-none"
                                style={{ WebkitTapHighlightColor: 'transparent' }}
                            >
                                {/* Minimalist Gold Thread Indicator */}
                                {active && (
                                    <motion.div
                                        layoutId="mobile-nav-thread"
                                        className="absolute top-0 inset-x-4 h-[2px] bg-[var(--gold)] shadow-[0_2px_10px_rgba(212,168,67,0.5)]"
                                        transition={{ type: "spring", stiffness: 400, damping: 35 }}
                                    />
                                )}
                                
                                <div className={`flex flex-col items-center gap-1.5 transition-all duration-400 ${active ? 'scale-100' : 'scale-95 opacity-60 hover:opacity-80'}`}>
                                    <Icon 
                                        size={20} 
                                        className={`transition-colors duration-400 ${active ? 'text-white drop-shadow-[0_0_8px_rgba(212,168,67,0.4)]' : 'text-zinc-400'}`}
                                        strokeWidth={active ? 2.5 : 2} 
                                    />
                                    <span className={`text-[9px] uppercase tracking-[0.1em] transition-colors duration-400 ${active ? 'font-bold text-[var(--gold)]' : 'font-medium text-zinc-500'}`}>
                                        {tab.label}
                                    </span>
                                </div>
                            </button>
                        )
                    })}
                </div>
            </nav>

            <WhatsNewCarousel isGuest={isGuest} />
        </>
    )
}
