'use client'

import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { getRobohashUrl } from '@/lib/wc2026-data'
import { Home, CalendarDays, Edit3, Users, Trophy, Globe } from 'lucide-react'

const TABS = [
    { href: '/dashboard', label: 'Dashboard', icon: Home },
    { href: '/fixtures', label: 'Fixtures', icon: CalendarDays },
    { href: '/predict', label: 'Predict', icon: Edit3 },
    { href: '/groups', label: 'Groups', icon: Users },
    { href: '/leaderboard', label: 'Rankings', icon: Trophy },
    { href: '/pulse', label: 'Pulse', icon: Globe }
]

export default function Nav({ initials = 'PL', displayName, isGuest }: { initials?: string; displayName?: string; isGuest?: boolean }) {
    const pathname = usePathname()
    const router = useRouter()
    const [supabase] = useState(() => createClient())
    const [menuOpen, setMenuOpen] = useState(false)

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.push('/auth/login')
        router.refresh()
    }

    const avatarSeed = displayName || initials || 'player'

    return (
        <>
            {/* Top Navigation */}
            <nav
                className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 md:px-8 h-16"
                style={{
                    background: 'rgba(10,10,10,0.92)',
                    backdropFilter: 'blur(12px)',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                }}
            >
                {/* Logo */}
                <div
                    className="cursor-pointer flex items-center"
                    onClick={() => router.push('/dashboard')}
                >
                    <img
                        src="/images/logo.png"
                        alt="FIFA World Cup 2026"
                        style={{ objectFit: 'contain', height: 38, width: 'auto' }}
                    />
                    <span className="font-display text-xl tracking-widest text-white ml-3 hidden sm:block">
                        VENTI<span className="text-white/40">·</span>26
                    </span>
                </div>

                {/* Desktop Tabs */}
                <div
                    className="hidden md:flex gap-1 p-1 rounded-xl"
                    style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
                >
                    {TABS.map(tab => {
                        const active = pathname.startsWith(tab.href)

                        return (
                            <button
                                key={tab.href}
                                onClick={() => router.push(tab.href)}
                                className="px-4 py-1.5 rounded-lg text-sm font-medium"
                                style={{
                                    background: active ? 'var(--surface3)' : 'transparent',
                                    color: active ? 'var(--cream)' : 'var(--dim)',
                                }}
                            >
                                {tab.label}
                            </button>
                        )
                    })}
                </div>

                {/* Avatar / Sign In */}
                {isGuest ? (
                    <button
                        onClick={() => router.push('/auth/login')}
                        style={{
                            padding: '8px 20px',
                            borderRadius: 10,
                            background: 'var(--gold)',
                            color: '#0a0a0a',
                            fontSize: 13,
                            fontWeight: 700,
                            border: 'none',
                            cursor: 'pointer',
                            fontFamily: 'DM Sans, sans-serif',
                        }}
                    >
                        Sign In
                    </button>
                ) : (
                <div style={{ position: 'relative' }}>
                    <img
                        src={getRobohashUrl(avatarSeed, 80)}
                        alt="avatar"
                        width={34}
                        height={34}
                        style={{
                            borderRadius: '50%',
                            cursor: 'pointer',
                            border: '2px solid var(--border-gold)',
                        }}
                        onClick={() => setMenuOpen(v => !v)}
                    />

                    {/* Dropdown */}
                    {menuOpen && (
                        <div
                            style={{
                                position: 'absolute',
                                right: 0,
                                top: 45,
                                width: 160,
                                borderRadius: 12,
                                background: 'var(--surface2)',
                                border: '1px solid var(--border)',
                                overflow: 'hidden',
                            }}
                        >
                            <button
                                onClick={handleSignOut}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    textAlign: 'left',
                                    fontSize: 13,
                                    color: 'var(--dim)',
                                }}
                            >
                                Sign out
                            </button>
                        </div>
                    )}
                </div>
                )}
            </nav>

            {/* Mobile Bottom Navigation */}
            <nav
                className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between h-16 overflow-x-auto"
                style={{
                    background: 'rgba(10,10,10,0.95)',
                    backdropFilter: 'blur(12px)',
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                    paddingBottom: 'env(safe-area-inset-bottom)', // Support for iOS home indicator
                }}
            >
                {TABS.map(tab => {
                    const active = pathname.startsWith(tab.href)
                    const Icon = tab.icon

                    return (
                        <button
                            key={tab.href}
                            onClick={() => router.push(tab.href)}
                            className="flex flex-col items-center justify-center w-full h-full gap-1"
                            style={{
                                minWidth: 64,
                                color: active ? 'var(--gold)' : 'var(--dim)',
                                WebkitTapHighlightColor: 'transparent'
                            }}
                        >
                            <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                            <span style={{ fontSize: 10, fontWeight: active ? 600 : 500 }}>{tab.label}</span>
                        </button>
                    )
                })}
            </nav>
        </>
    )
}