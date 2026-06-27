'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Clock, Lock, RefreshCw, Trophy } from 'lucide-react'
import TeamFlag from '@/components/TeamFlag'
import { getTeam } from '@/lib/wc2026-data'
import { isKnownTeamCode, type LiveBracketFixture, type KnockoutRound } from '@/lib/live-bracket'

type PickRow = {
    round: string
    slot_index: number
    team_code: string
    home_score: number | null
    away_score: number | null
    predicted_home_team?: string | null
    predicted_away_team?: string | null
    is_repredicted?: boolean | null
    original_team_code?: string | null
}

type DraftPick = {
    home: number | ''
    away: number | ''
    advancing: string | null
}

const ROUND_LABELS: Record<KnockoutRound, string> = {
    r32: 'Round of 32',
    r16: 'Round of 16',
    qf: 'Quarter-finals',
    sf: 'Semi-finals',
    third_place: '3rd place',
    final: 'Final',
}

const COLUMN_WIDTH = 236
const COLUMN_GAP = 34
const TILE_HEIGHT = 158
const SLOT_GAP = 204
const COLUMN_HEADER_HEIGHT = 36
const TREE_COLUMN_COUNT = 9
const TREE_WIDTH = TREE_COLUMN_COUNT * COLUMN_WIDTH + (TREE_COLUMN_COUNT - 1) * COLUMN_GAP
const TREE_HEIGHT = COLUMN_HEADER_HEIGHT + SLOT_GAP * 8 + 20
const LEFT_R32_POSITIONS = [0, 1, 2, 3, 4, 5, 6, 7]
const R16_POSITIONS = [0.5, 2.5, 4.5, 6.5]
const QF_POSITIONS = [1.5, 5.5]
const SF_POSITIONS = [3.5]
const FINAL_POSITIONS = [3.05, 4.05]

function pickKey(fixture: LiveBracketFixture) {
    return `${fixture.round}_${fixture.slotIndex}`
}

function formatKickoff(value: string) {
    const date = new Date(value)
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · ' +
        date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function formatFixtureTime(value: string) {
    const date = new Date(value)
    const day = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    return `${day} - ${time}`
}

function getFixtureState(fixture: LiveBracketFixture) {
    const known = isKnownTeamCode(fixture.homeCode) && isKnownTeamCode(fixture.awayCode)
    const kickoff = new Date(fixture.kickoff).getTime()
    const lockAt = kickoff - 15 * 60 * 1000
    const apiStatus = fixture.apiStatus || fixture.status
    const started = ['IN_PLAY', 'PAUSED', 'HALFTIME', 'FINISHED', 'finished', 'live'].includes(apiStatus)
    const locked = !known || started || Date.now() >= lockAt
    return { known, locked, started, lockAt }
}

function numberValue(value: number | '') {
    return value === '' ? null : value
}

function emptyDraft(): DraftPick {
    return { home: '', away: '', advancing: null }
}

function draftFromPick(pick?: PickRow): DraftPick {
    return pick && typeof pick.home_score === 'number' && typeof pick.away_score === 'number'
        ? { home: pick.home_score ?? '', away: pick.away_score ?? '', advancing: pick.team_code || null }
        : emptyDraft()
}

function sameDraft(a: DraftPick, b: DraftPick) {
    return a.home === b.home && a.away === b.away && a.advancing === b.advancing
}

function draftHasValues(draft: DraftPick) {
    return draft.home !== '' || draft.away !== '' || !!draft.advancing
}

function draftReadyToSave(fixture: LiveBracketFixture, draft: DraftPick) {
    const { known, locked } = getFixtureState(fixture)
    const tied = typeof draft.home === 'number' && typeof draft.away === 'number' && draft.home === draft.away
    return known && !locked && typeof draft.home === 'number' && typeof draft.away === 'number' && (!tied || !!draft.advancing)
}

function fixturePhaseLabel(fixture: LiveBracketFixture) {
    return `${ROUND_LABELS[fixture.round]} - Match ${fixture.matchNumber}`
}

function TeamCell({ code, seed, selected }: { code: string; seed: string; selected?: boolean }) {
    const known = isKnownTeamCode(code)
    const team = known ? getTeam(code) : null
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            minWidth: 0,
            color: known ? 'var(--cream)' : 'var(--muted)',
            fontWeight: selected ? 800 : 650,
        }}>
            {team ? (
                <TeamFlag teamCode={team.code} size={26} />
            ) : (
                <div style={{ width: 26, height: 17, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface3)' }} />
            )}
            <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {team?.name || 'Awaiting team'}
                </div>
                <div style={{ fontSize: 10, color: selected ? 'var(--gold)' : 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
                    {known ? code : seed}
                </div>
            </div>
        </div>
    )
}

function ScoreInput({
    value,
    disabled,
    onChange,
}: {
    value: number | ''
    disabled: boolean
    onChange: (value: number | '') => void
}) {
    return (
        <input
            type="number"
            min={0}
            max={20}
            inputMode="numeric"
            value={value}
            placeholder="-"
            disabled={disabled}
            onChange={event => {
                const raw = event.target.value
                if (raw === '') return onChange('')
                const parsed = Number.parseInt(raw, 10)
                if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 20) onChange(parsed)
            }}
            onFocus={event => event.currentTarget.select()}
            style={{
                width: 42,
                height: 34,
                flexShrink: 0,
                borderRadius: 8,
                border: value !== '' ? '1px solid var(--gold)' : '1px solid var(--border)',
                background: disabled ? 'rgba(255,255,255,0.03)' : 'var(--black)',
                color: value !== '' ? 'var(--gold)' : 'var(--cream)',
                textAlign: 'center',
                fontFamily: 'Bebas Neue',
                fontSize: 22,
                outline: 'none',
                opacity: disabled ? 0.45 : 1,
                MozAppearance: 'textfield',
            }}
        />
    )
}

function FixtureCard({
    fixture,
    draft,
    error,
    onDraftChange,
}: {
    fixture: LiveBracketFixture
    draft: DraftPick
    error?: string
    onDraftChange: (next: DraftPick) => void
}) {
    const { known, locked, started } = getFixtureState(fixture)
    const isFinal = fixture.round === 'final'
    const isThirdPlace = fixture.round === 'third_place'
    const homeSelected = draft.advancing === fixture.homeCode
    const awaySelected = draft.advancing === fixture.awayCode
    const tied = typeof draft.home === 'number' && typeof draft.away === 'number' && draft.home === draft.away
    const statusText = !known ? 'Waiting' : started ? 'Started' : locked ? 'Locked' : 'Open'
    const statusColor = !known ? 'var(--muted)' : started || locked ? '#ef4444' : '#22c55e'

    const setHome = (home: number | '') => {
        let advancing = draft.advancing
        if (typeof home === 'number' && typeof draft.away === 'number' && home !== draft.away) {
            advancing = home > draft.away ? fixture.homeCode : fixture.awayCode
        } else if (home === '' || draft.away === '') {
            advancing = null
        }
        onDraftChange({ ...draft, home, advancing })
    }

    const setAway = (away: number | '') => {
        let advancing = draft.advancing
        if (typeof draft.home === 'number' && typeof away === 'number' && draft.home !== away) {
            advancing = draft.home > away ? fixture.homeCode : fixture.awayCode
        } else if (draft.home === '' || away === '') {
            advancing = null
        }
        onDraftChange({ ...draft, away, advancing })
    }

    return (
        <div className={`fixture-tile ${isFinal ? 'fixture-tile-final' : ''} ${isThirdPlace ? 'fixture-tile-third' : ''}`} style={{
            border: isFinal ? '1px solid rgba(240,201,106,0.82)' : isThirdPlace ? '1px solid rgba(244,241,235,0.15)' : '1px solid var(--border)',
            background: isFinal
                ? 'linear-gradient(145deg, rgba(52,39,14,0.98), rgba(20,20,20,0.96) 46%, rgba(122,92,26,0.28))'
                : isThirdPlace
                    ? 'linear-gradient(145deg, rgba(36,36,36,0.96), rgba(18,18,18,0.96))'
                    : 'var(--surface2)',
            borderRadius: 8,
            overflow: 'hidden',
            opacity: known ? 1 : 0.72,
            boxShadow: isFinal
                ? '0 18px 42px rgba(0,0,0,0.42), 0 0 0 1px rgba(240,201,106,0.22), 0 0 32px rgba(212,168,67,0.18)'
                : known ? '0 10px 26px rgba(0,0,0,0.22)' : 'none',
        }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                padding: '8px 10px',
                borderBottom: isFinal ? '1px solid rgba(240,201,106,0.28)' : '1px solid var(--border)',
                background: isFinal ? 'rgba(212,168,67,0.12)' : 'rgba(0,0,0,0.22)',
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: isFinal ? 'var(--gold-light)' : 'var(--gold)', fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase' }}>
                        {isFinal && <Trophy size={13} />}
                        {fixturePhaseLabel(fixture)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, maxWidth: 150, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {fixture.pathLabel}
                    </div>
                </div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    color: statusColor,
                    fontSize: 11,
                    fontWeight: 800,
                    whiteSpace: 'nowrap',
                }}>
                    {!known ? <Clock size={14} /> : locked ? <Lock size={14} /> : <Check size={14} />}
                    {statusText}
                </div>
            </div>

            <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <TeamCell code={fixture.homeCode} seed={fixture.homeSeed} selected={homeSelected} />
                    </div>
                    <ScoreInput value={draft.home} disabled={!known || locked} onChange={setHome} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <TeamCell code={fixture.awayCode} seed={fixture.awaySeed} selected={awaySelected} />
                    </div>
                    <ScoreInput value={draft.away} disabled={!known || locked} onChange={setAway} />
                </div>

                {tied && known && !locked && (
                    <div style={{ display: 'flex', gap: 8, paddingTop: 2 }}>
                        {[fixture.homeCode, fixture.awayCode].map(code => {
                            const selected = draft.advancing === code
                            const team = getTeam(code)
                            return (
                                <button
                                    key={code}
                                    onClick={() => onDraftChange({ ...draft, advancing: code })}
                                    style={{
                                        flex: 1,
                                        minHeight: 30,
                                        borderRadius: 7,
                                        border: selected ? '1px solid var(--gold)' : '1px solid var(--border)',
                                        background: selected ? 'rgba(212,168,67,0.12)' : 'transparent',
                                        color: selected ? 'var(--gold)' : 'var(--muted)',
                                        fontSize: 12,
                                        fontWeight: 750,
                                        cursor: 'pointer',
                                    }}
                                >
                                    {team?.code} advances
                                </button>
                            )
                        })}
                    </div>
                )}

                <div style={{ fontSize: 11, color: 'var(--muted)', paddingTop: 2 }}>
                    {formatFixtureTime(fixture.kickoff)}
                </div>

                {error && <div style={{ fontSize: 12, color: '#ef4444', lineHeight: 1.45 }}>{error}</div>}
            </div>
        </div>
    )
}

function CompactBracketColumn({
    title,
    fixtures,
    positions,
    tone,
    drafts,
    errors,
    onDraftChange,
}: {
    title: string
    fixtures: LiveBracketFixture[]
    positions: number[]
    tone?: 'final'
    drafts: Record<string, DraftPick>
    errors: Record<string, string>
    onDraftChange: (key: string, next: DraftPick) => void
}) {
    return (
        <div className={`bracket-column ${tone === 'final' ? 'bracket-column-final' : ''}`}>
            <div className="bracket-column-title">
                {title}
            </div>
            {fixtures.map((fixture, index) => {
                const key = pickKey(fixture)
                const top = COLUMN_HEADER_HEIGHT + positions[index] * SLOT_GAP + (SLOT_GAP - TILE_HEIGHT) / 2
                return (
                    <div className="match-slot" key={fixture.id} style={{ top }}>
                        <FixtureCard
                            fixture={fixture}
                            draft={drafts[key] || { home: '', away: '', advancing: null }}
                            error={errors[key]}
                            onDraftChange={next => onDraftChange(key, next)}
                        />
                    </div>
                )
            })}
        </div>
    )
}

function columnLeft(index: number) {
    return index * (COLUMN_WIDTH + COLUMN_GAP)
}

function matchCenter(position: number) {
    return COLUMN_HEADER_HEIGHT + position * SLOT_GAP + SLOT_GAP / 2
}

function ConnectorPath({
    fromColumn,
    toColumn,
    fromPositions,
    toPosition,
}: {
    fromColumn: number
    toColumn: number
    fromPositions: [number, number]
    toPosition: number
}) {
    const fromRight = fromColumn < toColumn
    const fromX = fromRight ? columnLeft(fromColumn) + COLUMN_WIDTH : columnLeft(fromColumn)
    const toX = fromRight ? columnLeft(toColumn) : columnLeft(toColumn) + COLUMN_WIDTH
    const midX = fromRight ? fromX + COLUMN_GAP / 2 : fromX - COLUMN_GAP / 2
    const y1 = matchCenter(fromPositions[0])
    const y2 = matchCenter(fromPositions[1])
    const yTo = matchCenter(toPosition)
    const path = `M ${fromX} ${y1} H ${midX} V ${y2} H ${fromX} M ${midX} ${yTo} H ${toX}`
    return <path d={path} />
}

function SingleConnectorPath({
    fromColumn,
    toColumn,
    fromPosition,
    toPosition,
}: {
    fromColumn: number
    toColumn: number
    fromPosition: number
    toPosition: number
}) {
    const fromRight = fromColumn < toColumn
    const fromX = fromRight ? columnLeft(fromColumn) + COLUMN_WIDTH : columnLeft(fromColumn)
    const toX = fromRight ? columnLeft(toColumn) : columnLeft(toColumn) + COLUMN_WIDTH
    const bend = fromRight ? COLUMN_GAP * 0.58 : -COLUMN_GAP * 0.58
    const y1 = matchCenter(fromPosition)
    const y2 = matchCenter(toPosition)
    const path = `M ${fromX} ${y1} C ${fromX + bend} ${y1}, ${toX - bend} ${y2}, ${toX} ${y2}`
    return <path d={path} />
}

function BracketConnectors() {
    const pairPositions: [number, number][] = [[0, 1], [2, 3], [4, 5], [6, 7]]
    const r16Pairs: [number, number][] = [[0.5, 2.5], [4.5, 6.5]]
    const qfPairs: [number, number][] = [[1.5, 5.5]]

    return (
        <svg className="bracket-connectors" width={TREE_WIDTH} height={TREE_HEIGHT} aria-hidden="true">
            <g>
                {pairPositions.map((pair, index) => (
                    <ConnectorPath key={`l-r32-${index}`} fromColumn={0} toColumn={1} fromPositions={pair} toPosition={R16_POSITIONS[index]} />
                ))}
                {r16Pairs.map((pair, index) => (
                    <ConnectorPath key={`l-r16-${index}`} fromColumn={1} toColumn={2} fromPositions={pair} toPosition={QF_POSITIONS[index]} />
                ))}
                {qfPairs.map((pair, index) => (
                    <ConnectorPath key={`l-qf-${index}`} fromColumn={2} toColumn={3} fromPositions={pair} toPosition={SF_POSITIONS[index]} />
                ))}

                {pairPositions.map((pair, index) => (
                    <ConnectorPath key={`r-r32-${index}`} fromColumn={8} toColumn={7} fromPositions={pair} toPosition={R16_POSITIONS[index]} />
                ))}
                {r16Pairs.map((pair, index) => (
                    <ConnectorPath key={`r-r16-${index}`} fromColumn={7} toColumn={6} fromPositions={pair} toPosition={QF_POSITIONS[index]} />
                ))}
                {qfPairs.map((pair, index) => (
                    <ConnectorPath key={`r-qf-${index}`} fromColumn={6} toColumn={5} fromPositions={pair} toPosition={SF_POSITIONS[index]} />
                ))}

                <SingleConnectorPath fromColumn={3} toColumn={4} fromPosition={SF_POSITIONS[0]} toPosition={FINAL_POSITIONS[0]} />
                <SingleConnectorPath fromColumn={5} toColumn={4} fromPosition={SF_POSITIONS[0]} toPosition={FINAL_POSITIONS[0]} />
                <SingleConnectorPath fromColumn={3} toColumn={4} fromPosition={SF_POSITIONS[0]} toPosition={FINAL_POSITIONS[1]} />
                <SingleConnectorPath fromColumn={5} toColumn={4} fromPosition={SF_POSITIONS[0]} toPosition={FINAL_POSITIONS[1]} />
            </g>
        </svg>
    )
}

export default function LiveBracketClient({
    currentUserId,
    displayName,
    initialFixtures,
    initialPicks,
}: {
    currentUserId: string | null
    displayName: string
    initialFixtures: LiveBracketFixture[]
    initialPicks: PickRow[]
}) {
    const router = useRouter()
    const [fixtures] = useState(initialFixtures)
    const [picksByKey, setPicksByKey] = useState(() => {
        const map: Record<string, PickRow> = {}
        for (const pick of initialPicks) map[`${pick.round}_${pick.slot_index}`] = pick
        return map
    })
    const [drafts, setDrafts] = useState<Record<string, DraftPick>>(() => {
        const map: Record<string, DraftPick> = {}
        for (const fixture of initialFixtures) {
            const saved = initialPicks.find(pick => pick.round === fixture.round && pick.slot_index === fixture.slotIndex)
            map[pickKey(fixture)] = draftFromPick(saved)
        }
        return map
    })
    const [saving, setSaving] = useState(false)
    const [errors, setErrors] = useState<Record<string, string>>({})

    const byRound = useMemo(() => {
        const grouped: Record<KnockoutRound, LiveBracketFixture[]> = {
            r32: [], r16: [], qf: [], sf: [], third_place: [], final: [],
        }
        for (const fixture of fixtures) grouped[fixture.round].push(fixture)
        for (const round of Object.keys(grouped) as KnockoutRound[]) {
            grouped[round].sort((a, b) => a.slotIndex - b.slotIndex)
        }
        return grouped
    }, [fixtures])

    const availableCount = fixtures.filter(fixture => {
        const state = getFixtureState(fixture)
        return state.known && !state.locked
    }).length
    const waitingCount = fixtures.filter(fixture => !getFixtureState(fixture).known).length
    const savedCount = Object.values(picksByKey).filter(pick => typeof pick.home_score === 'number' && typeof pick.away_score === 'number').length

    const changedFixtures = fixtures.filter(fixture => {
        const key = pickKey(fixture)
        const draft = drafts[key] || emptyDraft()
        const saved = draftFromPick(picksByKey[key])
        return !sameDraft(draft, saved) && draftHasValues(draft)
    })

    const hasUnsavedChanges = changedFixtures.length > 0
    const canSaveChanges = Boolean(currentUserId) && changedFixtures.length > 0 && changedFixtures.every(fixture => draftReadyToSave(fixture, drafts[pickKey(fixture)] || emptyDraft()))

    const saveAllChanges = async () => {
        if (!currentUserId) return
        const nextErrors: Record<string, string> = {}
        for (const fixture of changedFixtures) {
            const key = pickKey(fixture)
            if (!draftReadyToSave(fixture, drafts[key] || emptyDraft())) {
                nextErrors[key] = 'Complete this pick first.'
            }
        }
        if (Object.keys(nextErrors).length > 0) {
            setErrors(prev => ({ ...prev, ...nextErrors }))
            return
        }

        setSaving(true)
        setErrors(prev => {
            const next = { ...prev }
            delete next.general
            for (const fixture of changedFixtures) delete next[pickKey(fixture)]
            return next
        })
        try {
            const savedPicks: Record<string, PickRow> = {}
            for (const fixture of changedFixtures) {
                const key = pickKey(fixture)
                const draft = drafts[key] || emptyDraft()
                const res = await fetch('/api/live-bracket/pick', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fixtureId: fixture.id,
                        homeScore: numberValue(draft.home),
                        awayScore: numberValue(draft.away),
                        advancingTeam: draft.advancing,
                    }),
                })
                const data = await res.json()
                if (!res.ok) throw new Error(data.error || 'Could not save prediction')
                savedPicks[key] = data.pick
            }
            setPicksByKey(prev => ({ ...prev, ...savedPicks }))
            router.refresh()
        } catch (error: any) {
            setErrors(prev => ({ ...prev, general: error.message || 'Could not save predictions' }))
        } finally {
            setSaving(false)
        }
    }

    const bracketColumnProps = {
        drafts,
        errors,
        onDraftChange: (key: string, next: DraftPick) => {
            setDrafts(prev => ({ ...prev, [key]: next }))
            setErrors(prev => {
                if (!prev[key] && !prev.general) return prev
                const nextErrors = { ...prev }
                delete nextErrors[key]
                delete nextErrors.general
                return nextErrors
            })
        },
    }

    return (
        <main className="live-main live-bracket-page" style={{ maxWidth: 1400, margin: '0 auto', padding: '104px 20px 90px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap', marginBottom: 20 }}>
                <div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--gold)', fontSize: 12, fontWeight: 850, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 10 }}>
                        <Trophy size={16} />
                        Road to the final
                    </div>
                    <h1 className="live-bracket-title" style={{ fontFamily: 'Bebas Neue', color: 'var(--cream)', fontSize: 56, lineHeight: 0.95, margin: 0 }}>
                        Live Bracket
                    </h1>
                </div>
                <div className="live-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(96px, 1fr))', gap: 10, width: 'min(100%, 420px)' }}>
                    {[
                        { label: 'Open', value: `${availableCount}` },
                        { label: 'Saved', value: `${savedCount}` },
                        { label: 'Waiting', value: `${waitingCount}` },
                    ].map(item => (
                        <div className="live-summary-card" key={item.label} style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', padding: 12 }}>
                            <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{item.label}</div>
                            <div style={{ color: 'var(--cream)', fontWeight: 850, marginTop: 5, fontSize: 18 }}>{item.value}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="live-bracket-note" style={{
                border: '1px solid rgba(212,168,67,0.32)',
                background: 'rgba(212,168,67,0.07)',
                borderRadius: 8,
                padding: '14px 16px',
                color: 'var(--dim)',
                fontSize: 13,
                lineHeight: 1.55,
                marginBottom: 24,
            }}>
                Hi {displayName}. Pick each knockout match once both teams are known. Your old bracket stays safe.
                {!currentUserId && ' Sign in to save your picks.'}
            </div>

            <section className="bracket-stage-shell" style={{
                border: '1px solid var(--border)',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: 8,
                overflow: 'hidden',
            }}>
                <div className="tree-shell-title" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 16,
                    padding: '14px 18px',
                    borderBottom: '1px solid var(--border)',
                    background: 'rgba(0,0,0,0.22)',
                }}>
                    <h2 style={{ fontFamily: 'Bebas Neue', color: 'var(--gold)', fontSize: 32, margin: 0, letterSpacing: 0 }}>
                        Bracket Tree
                    </h2>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {[
                            ['Open', '#22c55e'],
                            ['Locked', '#ef4444'],
                            ['Waiting', 'var(--muted)'],
                        ].map(([label, color]) => (
                            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, color, fontSize: 12, fontWeight: 750 }}>
                                <span style={{ width: 7, height: 7, borderRadius: 99, background: color }} />
                                {label}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bracket-workspace">
                    <div className="bracket-map">
                        <div className="bracket-scroll">
                            <div className="bracket-tree">
                                <BracketConnectors />
                                <div
                                    className="bracket-trophy-stage"
                                    style={{
                                        left: columnLeft(4) + COLUMN_WIDTH / 2,
                                        top: COLUMN_HEADER_HEIGHT + FINAL_POSITIONS[0] * SLOT_GAP + (SLOT_GAP - TILE_HEIGHT) / 2 - 14,
                                    }}
                                    aria-hidden="true"
                                >
                                    <img src="/images/trophy.png" alt="" />
                                </div>
                                <CompactBracketColumn
                                    title={ROUND_LABELS.r32}
                                    fixtures={byRound.r32.slice(0, 8)}
                                    positions={LEFT_R32_POSITIONS}
                                    {...bracketColumnProps}
                                />
                                <CompactBracketColumn
                                    title={ROUND_LABELS.r16}
                                    fixtures={byRound.r16.slice(0, 4)}
                                    positions={R16_POSITIONS}
                                    {...bracketColumnProps}
                                />
                                <CompactBracketColumn
                                    title={ROUND_LABELS.qf}
                                    fixtures={byRound.qf.slice(0, 2)}
                                    positions={QF_POSITIONS}
                                    {...bracketColumnProps}
                                />
                                <CompactBracketColumn
                                    title={ROUND_LABELS.sf}
                                    fixtures={byRound.sf.slice(0, 1)}
                                    positions={SF_POSITIONS}
                                    {...bracketColumnProps}
                                />
                                <CompactBracketColumn
                                    title="Final"
                                    fixtures={[...byRound.final, ...byRound.third_place]}
                                    positions={FINAL_POSITIONS}
                                    tone="final"
                                    {...bracketColumnProps}
                                />
                                <CompactBracketColumn
                                    title={ROUND_LABELS.sf}
                                    fixtures={byRound.sf.slice(1, 2)}
                                    positions={SF_POSITIONS}
                                    {...bracketColumnProps}
                                />
                                <CompactBracketColumn
                                    title={ROUND_LABELS.qf}
                                    fixtures={byRound.qf.slice(2, 4)}
                                    positions={QF_POSITIONS}
                                    {...bracketColumnProps}
                                />
                                <CompactBracketColumn
                                    title={ROUND_LABELS.r16}
                                    fixtures={byRound.r16.slice(4, 8)}
                                    positions={R16_POSITIONS}
                                    {...bracketColumnProps}
                                />
                                <CompactBracketColumn
                                    title={ROUND_LABELS.r32}
                                    fixtures={byRound.r32.slice(8, 16)}
                                    positions={LEFT_R32_POSITIONS}
                                    {...bracketColumnProps}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <div style={{
                position: 'fixed',
                bottom: 40,
                left: '50%',
                transform: hasUnsavedChanges ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(18px)',
                zIndex: 1000,
                display: 'flex',
                gap: 16,
                alignItems: 'center',
                padding: '12px 24px',
                background: 'rgba(20,20,20,0.88)',
                backdropFilter: 'blur(16px)',
                border: '1px solid var(--border-gold)',
                borderRadius: 50,
                boxShadow: '0 20px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(212,168,67,0.1)',
                transition: 'opacity 0.3s, transform 0.3s',
                opacity: hasUnsavedChanges ? 1 : 0,
                pointerEvents: hasUnsavedChanges ? 'auto' : 'none',
            }}>
                <div style={{ color: 'var(--cream)', fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap' }}>
                    {currentUserId ? `${changedFixtures.length} unsaved pick${changedFixtures.length === 1 ? '' : 's'}` : 'Sign in to save picks'}
                </div>
                <button
                    onClick={saveAllChanges}
                    disabled={!canSaveChanges || saving}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        background: canSaveChanges ? 'var(--gold)' : 'var(--surface3)',
                        color: canSaveChanges ? '#0a0a0a' : 'var(--muted)',
                        border: 'none',
                        padding: '10px 24px',
                        borderRadius: 30,
                        fontWeight: 700,
                        fontSize: 14,
                        cursor: canSaveChanges && !saving ? 'pointer' : 'default',
                        boxShadow: canSaveChanges ? '0 4px 15px rgba(212,168,67,0.4)' : 'none',
                    }}
                >
                    {saving && <RefreshCw size={14} />}
                    {saving ? 'Saving...' : 'Save All Changes'}
                </button>
                {errors.general && (
                    <div style={{ color: '#ef4444', fontSize: 12, maxWidth: 220 }}>
                        {errors.general}
                    </div>
                )}
            </div>

            <style jsx global>{`
                .live-bracket-page {
                    position: relative;
                }

                .live-bracket-page::before {
                    content: '';
                    position: fixed;
                    inset: 0;
                    pointer-events: none;
                    background: linear-gradient(180deg, rgba(212,168,67,0.035), transparent 32%);
                    z-index: -1;
                }

                .live-bracket-title {
                    background: linear-gradient(90deg, var(--cream), var(--gold-light) 42%, var(--gold));
                    -webkit-background-clip: text;
                    background-clip: text;
                    color: transparent !important;
                    text-shadow: 0 16px 42px rgba(212,168,67,0.12);
                }

                .live-summary-card {
                    background: linear-gradient(145deg, rgba(28,28,28,0.96), rgba(12,12,12,0.98)) !important;
                    border-color: rgba(255,255,255,0.09) !important;
                    box-shadow: inset 0 1px 0 rgba(255,255,255,0.04), 0 12px 28px rgba(0,0,0,0.2);
                }

                .live-bracket-note {
                    background: linear-gradient(90deg, rgba(212,168,67,0.12), rgba(212,168,67,0.04)) !important;
                    box-shadow: inset 0 1px 0 rgba(240,201,106,0.08);
                }

                .bracket-stage-shell {
                    border-color: rgba(212,168,67,0.18) !important;
                    background:
                        linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.012)),
                        rgba(255,255,255,0.015) !important;
                    box-shadow: 0 24px 70px rgba(0,0,0,0.34);
                }

                .tree-shell-title {
                    background:
                        linear-gradient(90deg, rgba(212,168,67,0.11), rgba(0,0,0,0.22) 38%, rgba(212,168,67,0.08)) !important;
                    border-bottom-color: rgba(212,168,67,0.16) !important;
                }

                .bracket-workspace {
                    padding: 20px;
                }

                .bracket-map {
                    min-width: 0;
                    border: 1px solid rgba(212,168,67,0.14);
                    border-radius: 8px;
                    background:
                        linear-gradient(90deg, rgba(212,168,67,0.035), transparent 18%, transparent 82%, rgba(212,168,67,0.035)),
                        rgba(0,0,0,0.2);
                    overflow: hidden;
                    box-shadow: inset 0 1px 0 rgba(255,255,255,0.035);
                }

                .bracket-scroll {
                    overflow: auto;
                    padding: 18px;
                    -webkit-overflow-scrolling: touch;
                }

                .bracket-tree {
                    position: relative;
                    width: ${TREE_WIDTH}px;
                    min-width: ${TREE_WIDTH}px;
                    height: ${TREE_HEIGHT}px;
                    display: grid;
                    grid-template-columns: repeat(${TREE_COLUMN_COUNT}, ${COLUMN_WIDTH}px);
                    column-gap: ${COLUMN_GAP}px;
                }

                .bracket-column {
                    position: relative;
                    z-index: 2;
                    width: ${COLUMN_WIDTH}px;
                    height: 100%;
                }

                .bracket-column-title {
                    height: ${COLUMN_HEADER_HEIGHT}px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: rgba(244,241,235,0.54);
                    font-size: 10px;
                    font-weight: 850;
                    letter-spacing: 1.4px;
                    text-transform: uppercase;
                    border-bottom: 1px solid rgba(255,255,255,0.07);
                }

                .bracket-column-final .bracket-column-title {
                    color: var(--gold-light);
                    border-bottom-color: rgba(240,201,106,0.34);
                    text-shadow: 0 0 18px rgba(212,168,67,0.22);
                }

                .match-slot {
                    position: absolute;
                    left: 0;
                    width: 100%;
                    min-height: ${TILE_HEIGHT}px;
                    z-index: 3;
                }

                .bracket-connectors {
                    position: absolute;
                    inset: 0;
                    z-index: 1;
                    pointer-events: none;
                    overflow: visible;
                }

                .bracket-connectors path {
                    fill: none;
                    stroke: rgba(212,168,67,0.34);
                    stroke-width: 1.5;
                    stroke-linecap: round;
                    stroke-linejoin: round;
                    filter: drop-shadow(0 0 7px rgba(212,168,67,0.12));
                }

                .bracket-trophy-stage {
                    position: absolute;
                    width: 118px;
                    height: 86px;
                    transform: translate(-50%, -100%);
                    z-index: 9;
                    pointer-events: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .bracket-trophy-stage img {
                    position: relative;
                    z-index: 2;
                    width: 82px;
                    height: 82px;
                    object-fit: contain;
                    opacity: 1;
                    filter: drop-shadow(0 14px 22px rgba(0,0,0,0.42)) drop-shadow(0 0 14px rgba(212,168,67,0.24));
                }

                .fixture-tile {
                    width: 100%;
                    min-height: ${TILE_HEIGHT}px;
                    transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
                }

                .fixture-tile:hover {
                    border-color: rgba(212,168,67,0.34) !important;
                    box-shadow: 0 14px 34px rgba(0,0,0,0.3), 0 0 0 1px rgba(212,168,67,0.08) !important;
                }

                .fixture-tile-final {
                    position: relative;
                    transform: scale(1.035);
                    z-index: 8;
                }

                .fixture-tile-final:hover {
                    border-color: var(--gold-light) !important;
                    box-shadow: 0 22px 52px rgba(0,0,0,0.42), 0 0 0 1px rgba(240,201,106,0.38), 0 0 42px rgba(212,168,67,0.22) !important;
                }

                .fixture-tile-final::before {
                    content: '';
                    position: absolute;
                    inset: -1px;
                    pointer-events: none;
                    border-radius: 8px;
                    background: linear-gradient(120deg, rgba(240,201,106,0.42), transparent 34%, rgba(240,201,106,0.2));
                    opacity: 0.42;
                    mix-blend-mode: screen;
                }

                .fixture-tile-final::after {
                    content: '';
                    position: absolute;
                    left: 18px;
                    right: 18px;
                    top: 0;
                    height: 2px;
                    background: linear-gradient(90deg, transparent, var(--gold-light), transparent);
                    box-shadow: 0 0 18px rgba(240,201,106,0.7);
                }

                .fixture-tile-third {
                    opacity: 0.88 !important;
                }

                .fixture-tile input::-webkit-outer-spin-button,
                .fixture-tile input::-webkit-inner-spin-button {
                    appearance: none;
                    margin: 0;
                }

                @media (max-width: 820px) {
                    .live-main {
                        padding: 92px 12px 90px !important;
                    }

                    .live-summary {
                        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
                        width: 100% !important;
                    }

                    .tree-shell-title {
                        align-items: flex-start !important;
                        flex-direction: column;
                    }

                    .bracket-workspace {
                        padding: 12px;
                    }

                    .bracket-scroll {
                        padding: 10px;
                    }

                    .bracket-tree {
                        width: ${TREE_WIDTH}px;
                        min-width: ${TREE_WIDTH}px;
                        height: ${TREE_HEIGHT}px;
                    }
                }
            `}</style>
        </main>
    )
}
