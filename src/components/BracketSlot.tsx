'use client'

interface Team {
    code: string
    name: string
    flag: string
}

interface Props {
    teams: Team[]
    pickedCode?: string
    onPick: (code: string) => void
    round: string
    slotIndex: number
}

export default function BracketSlot({ teams, pickedCode, onPick }: Props) {
    return (
        <div
            className="rounded-xl overflow-hidden transition-all duration-150"
            style={{
                background: 'var(--surface)',
                border: pickedCode
                    ? '1px solid rgba(212,168,67,0.25)'
                    : '1px solid var(--border)',
            }}
        >
            {teams.map((team, i) => {
                const isWinner = pickedCode === team.code
                const isTBD = team.code === 'TBD'

                return (
                    <div
                        key={team.code + i}
                        className="flex items-center gap-2 px-3 py-2.5 transition-colors duration-150"
                        style={{
                            borderBottom: i === 0 ? '1px solid var(--border)' : 'none',
                            background: isWinner
                                ? 'rgba(212,168,67,0.10)'
                                : 'transparent',
                            color: isWinner
                                ? 'var(--gold)'
                                : isTBD
                                    ? 'var(--muted)'
                                    : 'var(--cream)',
                            cursor: isTBD ? 'default' : 'pointer',
                        }}
                        onClick={() => {
                            if (!isTBD) onPick(team.code)
                        }}
                        onMouseEnter={e => {
                            if (!isTBD && !isWinner) {
                                (e.currentTarget as HTMLDivElement).style.background =
                                    'rgba(255,255,255,0.04)'
                            }
                        }}
                        onMouseLeave={e => {
                            if (!isWinner) {
                                (e.currentTarget as HTMLDivElement).style.background =
                                    'transparent'
                            }
                        }}
                    >
                        {/* Flag */}
                        <span className="text-base flex-shrink-0">
                            {isTBD ? '🏳️' : team.flag}
                        </span>

                        {/* Name */}
                        <span className="flex-1 truncate text-xs font-medium">
                            {isTBD ? 'TBD' : team.name}
                        </span>

                        {/* Winner indicator */}
                        {isWinner && (
                            <span className="text-gold text-xs flex-shrink-0">✓</span>
                        )}
                    </div>
                )
            })}
        </div>
    )
}