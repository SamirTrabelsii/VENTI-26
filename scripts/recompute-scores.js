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

function classifyType(breakdown) {
  const rules = breakdown.map(b => b.rule)
  if (rules.includes('Exact scoreline')) return 'exact'
  if (rules.includes('Correct goal difference')) return 'goal_diff'
  if (rules.includes('Correct outcome')) return 'correct'
  if (breakdown.length > 0) return 'partial'
  return 'miss'
}

function coreScore(predHome, predAway, realHome, realAway) {
  const breakdown = []

  if (predHome === realHome && predAway === realAway) {
    breakdown.push({ rule: 'Exact scoreline', pts: 25 })
    return breakdown
  }

  if (outcome(predHome, predAway) === outcome(realHome, realAway)) {
    breakdown.push({ rule: 'Correct outcome', pts: 10 })
    if (Math.abs(predHome - predAway) === Math.abs(realHome - realAway)) {
      breakdown.push({ rule: 'Correct goal difference', pts: 5 })
    }
  }

  if (predHome === realHome) {
    breakdown.push({ rule: 'Correct home team goals', pts: Math.max(1, realHome) })
  }
  if (predAway === realAway) {
    breakdown.push({ rule: 'Correct away team goals', pts: Math.max(1, realAway) })
  }

  return breakdown
}

function scoreMatch(predHome, predAway, realHome, realAway, isKnockout, options = {}) {
  const breakdown = coreScore(predHome, predAway, realHome, realAway)

  if (isKnockout) {
    const {
      predQualifier = null,
      realQualifier = null,
      isRepredicted = false,
      multiplier = 1,
      isFixtureCorrect = true,
    } = options

    if (!isRepredicted && !isFixtureCorrect) {
      return { total: 0, type: 'miss', breakdown: [{ rule: 'Invalid fixture (Original Prediction)', pts: 0 }] }
    }

    if (outcome(realHome, realAway) === 0 && predQualifier && realQualifier && predQualifier === realQualifier) {
      breakdown.push({ rule: 'Correct qualifier (knockout)', pts: 10 })
    }

    let total = breakdown.reduce((sum, b) => sum + b.pts, 0)
    if (!isRepredicted && isFixtureCorrect && multiplier > 1 && total > 0) {
      const bonus = (total * multiplier) - total
      breakdown.push({ rule: `Original Prediction Multiplier (x${multiplier})`, pts: bonus })
      total *= multiplier
    }

    return { total, type: classifyType(breakdown), breakdown }
  }

  const total = breakdown.reduce((sum, b) => sum + b.pts, 0)
  return { total, type: classifyType(breakdown), breakdown }
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

function matchIdForPick(pick) {
  if (pick.round === 'final' || pick.round === 'third_place') return pick.round
  return `${pick.round}_${pick.slot_index + 1}`
}

async function main() {
  const apply = process.argv.includes('--apply')
  const env = readEnv()
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.VITE_SUPABASE_SECRET_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const [matches, predictions, bracketPicks, memberships, existingScores] = await Promise.all([
    fetchAll(supabase, 'matches', '*'),
    fetchAll(supabase, 'predictions', '*'),
    fetchAll(supabase, 'bracket_picks', '*'),
    fetchAll(supabase, 'group_members', 'user_id, group_id'),
    fetchAll(supabase, 'scores', 'user_id, group_id, bracket_bonus_points'),
  ])

  const finished = matches
    .filter(m => m.status === 'finished' && m.home_score !== null && m.away_score !== null)
    .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())

  const predictionByUserMatch = new Map()
  for (const p of predictions) {
    predictionByUserMatch.set(`${p.user_id}:${p.match_id}`, p)
  }
  for (const bp of bracketPicks) {
    predictionByUserMatch.set(`${bp.user_id}:${matchIdForPick(bp)}`, {
      ...bp,
      match_id: matchIdForPick(bp),
      qualifier_pick: bp.team_code,
    })
  }

  const bonusByUserGroup = new Map()
  for (const score of existingScores) {
    bonusByUserGroup.set(`${score.user_id}:${score.group_id}`, score.bracket_bonus_points || 0)
  }

  const userScores = new Map()
  for (const member of memberships) {
    if (!userScores.has(member.user_id)) {
      userScores.set(member.user_id, {
        total: 0,
        exact: 0,
        correct: 0,
        currentStreak: 0,
      })
    }
  }

  for (const match of finished) {
    const isKnockout = match.stage ? !['group', 'group_stage', 'GROUP_STAGE'].includes(match.stage) : false
    for (const [userId, stats] of userScores) {
      const p = predictionByUserMatch.get(`${userId}:${match.id}`)

      if (!p) {
        stats.currentStreak = 0
        continue
      }

      const predHome = !p.is_repredicted && typeof p.original_home_score === 'number'
        ? p.original_home_score
        : p.home_score
      const predAway = !p.is_repredicted && typeof p.original_away_score === 'number'
        ? p.original_away_score
        : p.away_score

      if (typeof predHome !== 'number' || typeof predAway !== 'number') {
        stats.currentStreak = 0
        continue
      }

      const fixtureCorrect = !isKnockout ||
        !p.predicted_home_team ||
        !p.predicted_away_team ||
        (p.predicted_home_team === match.home_team && p.predicted_away_team === match.away_team)

      const result = scoreMatch(
        predHome,
        predAway,
        match.home_score,
        match.away_score,
        isKnockout,
        {
          predQualifier: p.qualifier_pick || p.qualifier || p.team_code || null,
          realQualifier: match.qualifier || null,
          isRepredicted: !!p.is_repredicted,
          multiplier: match.multiplier || 1,
          isFixtureCorrect: fixtureCorrect,
        }
      )

      stats.total += result.total
      if (result.type === 'exact') stats.exact += 1
      if (['exact', 'correct', 'goal_diff'].includes(result.type)) {
        stats.correct += 1
        stats.currentStreak += 1
      } else {
        stats.currentStreak = 0
      }
    }
  }

  const rows = memberships.map(member => {
    const stats = userScores.get(member.user_id) || { total: 0, exact: 0, correct: 0, currentStreak: 0 }
    const bonus = bonusByUserGroup.get(`${member.user_id}:${member.group_id}`) || 0
    return {
      user_id: member.user_id,
      group_id: member.group_id,
      total_points: stats.total + bonus,
      exact_scores: stats.exact,
      correct_results: stats.correct,
      streak: stats.currentStreak,
      bracket_bonus_points: bonus,
      updated_at: new Date().toISOString(),
    }
  })

  console.log(`${apply ? 'APPLY' : 'DRY RUN'} recompute`)
  console.log(`Finished matches: ${finished.length}`)
  console.log(`Membership rows to upsert: ${rows.length}`)

  const beforeByKey = new Map()
  const currentScores = await fetchAll(supabase, 'scores', 'user_id, group_id, total_points')
  for (const score of currentScores) beforeByKey.set(`${score.user_id}:${score.group_id}`, score.total_points)

  const changed = rows.filter(row => beforeByKey.get(`${row.user_id}:${row.group_id}`) !== row.total_points)
  console.log(`Changed score rows: ${changed.length}`)

  if (!apply) {
    console.log('Run again with --apply to write the recomputed scores.')
    return
  }

  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500)
    const { error } = await supabase
      .from('scores')
      .upsert(batch, { onConflict: 'user_id,group_id' })
    if (error) throw error
  }

  console.log('Scores recomputed and upserted successfully.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
