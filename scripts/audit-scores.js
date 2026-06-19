const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

function readEnv() {
  const env = {}
  const content = fs.readFileSync('.env.local', 'utf8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim()
  }
  return env
}

function outcome(home, away) {
  if (home > away) return 1
  if (home < away) return -1
  return 0
}

function scoreMatch(predHome, predAway, realHome, realAway) {
  let total = 0
  const breakdown = []

  if (predHome === realHome && predAway === realAway) {
    return { total: 25, type: 'exact', breakdown: ['Exact scoreline +25'] }
  }

  if (outcome(predHome, predAway) === outcome(realHome, realAway)) {
    total += 10
    breakdown.push('Correct outcome +10')

    if (Math.abs(predHome - predAway) === Math.abs(realHome - realAway)) {
      total += 5
      breakdown.push('Correct goal difference +5')
    }
  }

  if (predHome === realHome) {
    const pts = Math.max(1, realHome)
    total += pts
    breakdown.push(`Correct home goals +${pts}`)
  }

  if (predAway === realAway) {
    const pts = Math.max(1, realAway)
    total += pts
    breakdown.push(`Correct away goals +${pts}`)
  }

  const type = breakdown.some(x => x.startsWith('Correct goal difference'))
    ? 'goal_diff'
    : breakdown.some(x => x.startsWith('Correct outcome'))
      ? 'correct'
      : breakdown.length > 0
        ? 'partial'
        : 'miss'

  return { total, type, breakdown }
}

async function fetchAll(supabase, table, select = '*') {
  const rows = []
  let from = 0
  while (true) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + 999)
    if (error) throw error
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < 1000) break
    from += 1000
  }
  return rows
}

async function main() {
  const env = readEnv()
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.VITE_SUPABASE_SECRET_ROLE_KEY
  )

  const [profiles, matches, predictions, scores] = await Promise.all([
    fetchAll(supabase, 'profiles', 'id, display_name, email'),
    fetchAll(supabase, 'matches', 'id, status, home_score, away_score, kickoff, home_team, away_team'),
    fetchAll(supabase, 'predictions', 'user_id, match_id, home_score, away_score, original_home_score, original_away_score, is_repredicted'),
    fetchAll(supabase, 'scores', 'user_id, group_id, total_points, exact_scores, correct_results, streak'),
  ])

  const finished = matches
    .filter(m => m.status === 'finished' && m.home_score !== null && m.away_score !== null)
    .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())

  const predictionByUserMatch = new Map()
  for (const p of predictions) {
    predictionByUserMatch.set(`${p.user_id}:${p.match_id}`, p)
  }

  const storedByUser = new Map()
  for (const s of scores) {
    const existing = storedByUser.get(s.user_id)
    if (!existing || s.total_points > existing.total_points) storedByUser.set(s.user_id, s)
  }

  const users = new Set([
    ...profiles.map(p => p.id),
    ...predictions.map(p => p.user_id),
    ...scores.map(s => s.user_id),
  ])

  const profileById = new Map(profiles.map(p => [p.id, p]))
  const mismatches = []

  for (const userId of users) {
    let total = 0
    let exact = 0
    let correct = 0
    const perMatch = []
    const cumulative = []

    for (const m of finished) {
      const p = predictionByUserMatch.get(`${userId}:${m.id}`)
      if (!p) {
        cumulative.push({ id: m.id, total })
        continue
      }

      const predHome = !p.is_repredicted && typeof p.original_home_score === 'number'
        ? p.original_home_score
        : p.home_score
      const predAway = !p.is_repredicted && typeof p.original_away_score === 'number'
        ? p.original_away_score
        : p.away_score

      if (typeof predHome !== 'number' || typeof predAway !== 'number') {
        cumulative.push({ id: m.id, total })
        continue
      }

      const result = scoreMatch(predHome, predAway, m.home_score, m.away_score)
      total += result.total
      if (result.type === 'exact') exact += 1
      if (['exact', 'correct', 'goal_diff'].includes(result.type)) correct += 1
      perMatch.push({
        id: m.id,
        teams: `${m.home_team}-${m.away_team}`,
        prediction: `${predHome}-${predAway}`,
        result: `${m.home_score}-${m.away_score}`,
        points: result.total,
        breakdown: result.breakdown.join(', ') || '0',
      })
      cumulative.push({ id: m.id, total })
    }

    const stored = storedByUser.get(userId)
    const storedTotal = stored?.total_points ?? 0
    const matchingPrefix = cumulative.findIndex(c => c.total === storedTotal)
    if (storedTotal !== total) {
      const profile = profileById.get(userId)
      mismatches.push({
        userId,
        displayName: profile?.display_name ?? '(no profile)',
        email: profile?.email ?? '',
        storedTotal,
        recomputedTotal: total,
        delta: total - storedTotal,
        exact,
        correct,
        matchingPrefix: matchingPrefix === -1 ? null : matchingPrefix + 1,
        matchingPrefixMatch: matchingPrefix === -1 ? null : cumulative[matchingPrefix].id,
        perMatch,
      })
    }
  }

  mismatches.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  console.log(`Finished matches: ${finished.length}`)
  console.log(`Profiles: ${profiles.length}`)
  console.log(`Predictions: ${predictions.length}`)
  console.log(`Score rows: ${scores.length}`)
  console.log(`Users with stored/recomputed mismatch: ${mismatches.length}`)

  const limit = Number(process.env.LIMIT || 20)
  for (const m of mismatches.slice(0, limit)) {
    console.log('')
    console.log(`${m.displayName} <${m.email}>`)
    console.log(`  stored=${m.storedTotal} recomputed=${m.recomputedTotal} delta=${m.delta}`)
    console.log(`  stored matches recomputed prefix: ${m.matchingPrefix ?? 'no'}${m.matchingPrefixMatch ? ` through ${m.matchingPrefixMatch}` : ''}`)
    console.log(`  exact=${m.exact} correct=${m.correct}`)
    for (const row of m.perMatch.filter(r => r.points > 0)) {
      console.log(`  ${row.id} ${row.teams} pred=${row.prediction} result=${row.result} pts=${row.points} (${row.breakdown})`)
    }
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
