import { getTeam } from '@/lib/wc2026-data'
import TeamFlag from '@/components/TeamFlag'

interface KnockoutMatchCardProps {
    matchId: string
    homeCode: string
    awayCode: string
    homeScore: number | ''
    awayScore: number | ''
    advancingCode: string | null
    onChange: (matchId: string, home: number | '', away: number | '', advancing: string | null) => void
}

const SCORE_OPTIONS = Array.from({ length: 11 }, (_, i) => i) // 0–10

export default function KnockoutMatchCard({
    matchId,
    homeCode,
    awayCode,
    homeScore,
    awayScore,
    advancingCode,
    onChange
}: KnockoutMatchCardProps) {
    const isTied = typeof homeScore === 'number' && typeof awayScore === 'number' && homeScore === awayScore

    const handleHomeChange = (val: number | '') => {
        let newAdvancing = advancingCode
        if (typeof val === 'number' && typeof awayScore === 'number' && val !== awayScore) {
            newAdvancing = val > awayScore ? homeCode : awayCode
        } else if (typeof val === 'number' && typeof awayScore === 'number' && val === awayScore) {
            if (newAdvancing !== homeCode && newAdvancing !== awayCode) {
                newAdvancing = null
            }
        } else {
            newAdvancing = null
        }
        onChange(matchId, val, awayScore, newAdvancing)
    }

    const handleAwayChange = (val: number | '') => {
        let newAdvancing = advancingCode
        if (typeof homeScore === 'number' && typeof val === 'number' && homeScore !== val) {
            newAdvancing = homeScore > val ? homeCode : awayCode
        } else if (typeof homeScore === 'number' && typeof val === 'number' && homeScore === val) {
            if (newAdvancing !== homeCode && newAdvancing !== awayCode) {
                newAdvancing = null
            }
        } else {
            newAdvancing = null
        }
        onChange(matchId, homeScore, val, newAdvancing)
    }

    const isHomeTBD = homeCode === 'TBD' || homeCode.startsWith('1') || homeCode.startsWith('2') || homeCode === 'T3'
    const isAwayTBD = awayCode === 'TBD' || awayCode.startsWith('1') || awayCode.startsWith('2') || awayCode === 'T3'

    const homeTeam = isHomeTBD ? null : getTeam(homeCode)
    const awayTeam = isAwayTBD ? null : getTeam(awayCode)

    const selectStyle: React.CSSProperties = {
        background: 'var(--surface)',
        border: '2px solid var(--border)',
        borderRadius: 10,
        color: 'var(--cream)',
        fontFamily: 'Bebas Neue, sans-serif',
        fontSize: 28,
        width: 52,
        height: 52,
        textAlign: 'center',
        outline: 'none',
        cursor: isHomeTBD || isAwayTBD ? 'default' : 'pointer',
        appearance: 'none',
        WebkitAppearance: 'none',
        flexShrink: 0,
    }

    const teamRowStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
    }

    return (
        <div style={{
            background: 'var(--surface2)',
            borderRadius: 12,
            border: '1px solid var(--border)',
            overflow: 'hidden',
        }}>
            {/* Home team row */}
            <div style={{
                ...teamRowStyle,
                borderBottom: '1px solid var(--border)',
            }}>
                {homeTeam ? (
                    <TeamFlag teamCode={homeTeam.code} size={28} />
                ) : (
                    <span style={{ fontSize: 20, flexShrink: 0 }}>🏳️</span>
                )}
                <span style={{
                    fontWeight: 600,
                    color: 'var(--cream)',
                    fontSize: 13,
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                }}>
                    {homeTeam ? homeTeam.name : homeCode}
                </span>

                <select
                    value={homeScore}
                    onChange={e => {
                        const val = e.target.value === '' ? '' : Number(e.target.value)
                        handleHomeChange(val)
                    }}
                    disabled={isHomeTBD || isAwayTBD}
                    style={{
                        ...selectStyle,
                        borderColor: (homeScore !== '' && homeScore > 0) ? 'var(--gold)' : 'var(--border)',
                        color: (homeScore !== '' && homeScore > 0) ? 'var(--gold)' : 'var(--cream)',
                        opacity: (isHomeTBD || isAwayTBD) ? 0.4 : 1,
                    }}
                >
                    <option value="" style={{ background: '#1c1c1c', fontSize: 14 }}>—</option>
                    {SCORE_OPTIONS.map(n => (
                        <option key={n} value={n} style={{ background: '#1c1c1c', fontSize: 14 }}>
                            {n}
                        </option>
                    ))}
                </select>
            </div>

            {/* Away team row */}
            <div style={teamRowStyle}>
                {awayTeam ? (
                    <TeamFlag teamCode={awayTeam.code} size={28} />
                ) : (
                    <span style={{ fontSize: 20, flexShrink: 0 }}>🏳️</span>
                )}
                <span style={{
                    fontWeight: 600,
                    color: 'var(--cream)',
                    fontSize: 13,
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                }}>
                    {awayTeam ? awayTeam.name : awayCode}
                </span>

                <select
                    value={awayScore}
                    onChange={e => {
                        const val = e.target.value === '' ? '' : Number(e.target.value)
                        handleAwayChange(val)
                    }}
                    disabled={isHomeTBD || isAwayTBD}
                    style={{
                        ...selectStyle,
                        borderColor: (awayScore !== '' && awayScore > 0) ? 'var(--gold)' : 'var(--border)',
                        color: (awayScore !== '' && awayScore > 0) ? 'var(--gold)' : 'var(--cream)',
                        opacity: (isHomeTBD || isAwayTBD) ? 0.4 : 1,
                    }}
                >
                    <option value="" style={{ background: '#1c1c1c', fontSize: 14 }}>—</option>
                    {SCORE_OPTIONS.map(n => (
                        <option key={n} value={n} style={{ background: '#1c1c1c', fontSize: 14 }}>
                            {n}
                        </option>
                    ))}
                </select>
            </div>

            {/* Tie-breaker UI */}
            {isTied && !isHomeTBD && !isAwayTBD && (
                <div style={{
                    padding: '10px 14px',
                    borderTop: '1px dashed var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8
                }}>
                    <div style={{ fontSize: 10, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 600 }}>
                        Advances on Penalties
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                        {[
                            { code: homeCode, team: homeTeam },
                            { code: awayCode, team: awayTeam },
                        ].map(({ code, team }) => {
                            const isSelected = advancingCode === code
                            return (
                                <button
                                    key={code}
                                    onClick={() => onChange(matchId, homeScore as number, awayScore as number, code)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        padding: '6px 12px',
                                        borderRadius: 8,
                                        border: isSelected ? '1px solid var(--gold)' : '1px solid var(--border)',
                                        background: isSelected ? 'rgba(212,168,67,0.12)' : 'transparent',
                                        color: isSelected ? 'var(--gold)' : 'var(--muted)',
                                        cursor: 'pointer',
                                        fontSize: 12,
                                        fontWeight: isSelected ? 700 : 500,
                                        transition: 'all 0.15s ease',
                                    }}
                                >
                                    {team && (
                                        <TeamFlag teamCode={team.code} size={16} />
                                    )}
                                    {team?.name || code}
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
