'use client'

interface Action {
    href: string
    icon: string
    label: string
    sub: string
}

export default function QuickActions({
    actions,
}: {
    actions: Action[]
}) {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
            }}
        >
            {actions.map((a) => (
                <a
                    key={a.href}
                    href={a.href}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '11px 13px',
                        borderRadius: 11,
                        textDecoration: 'none',
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-gold)'
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border)'
                    }}
                >
                    <span style={{ fontSize: 18 }}>{a.icon}</span>

                    <div style={{ flex: 1 }}>
                        <div
                            style={{
                                fontSize: 13,
                                fontWeight: 500,
                                color: 'var(--cream)',
                            }}
                        >
                            {a.label}
                        </div>

                        <div
                            style={{
                                fontSize: 11,
                                color: 'var(--muted)',
                            }}
                        >
                            {a.sub}
                        </div>
                    </div>

                    <span
                        style={{
                            color: 'var(--muted)',
                            fontSize: 13,
                        }}
                    >
                        →
                    </span>
                </a>
            ))}
        </div>
    )
}