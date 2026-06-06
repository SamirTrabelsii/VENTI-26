'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { getRobohashUrl } from '@/lib/wc2026-data'

const TABS = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/fixtures', label: 'Fixtures' },
    { href: '/predict', label: 'Predict' },
    { href: '/groups', label: 'Groups' },
    { href: '/leaderboard', label: 'Leaderboard' }
]

export default function Nav({ initials = 'PL', displayName }: { initials?: string; displayName?: string }) {
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createClient()
    const [menuOpen, setMenuOpen] = useState(false)

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.push('/auth/login')
        router.refresh()
    }

    const avatarSeed = displayName || initials || 'player'

    return (
        <nav
            className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 h-16"
            style={{
                background: 'rgba(10,10,10,0.92)',
                backdropFilter: 'blur(12px)',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}
        >
            {/* Logo */}
            <div
                className="font-display text-2xl tracking-widest text-gold cursor-pointer"
                onClick={() => router.push('/dashboard')}
            >
                VENTI<span className="text-cream opacity-40">·</span>26
            </div>

            {/* Tabs */}
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

            {/* Avatar */}
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
        </nav>
    )
}