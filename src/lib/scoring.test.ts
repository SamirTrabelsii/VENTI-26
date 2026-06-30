import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { scoreMatch } from './scoring'

describe('scoreMatch', () => {
    it('awards 25 points for an exact score and no other base bonuses', () => {
        const result = scoreMatch(2, 1, 2, 1)

        assert.equal(result.total, 25)
        assert.equal(result.type, 'exact')
        assert.deepEqual(result.breakdown, [
            { rule: 'Perfect prediction', pts: 25 },
        ])
    })

    it('adds correct-result and goal-accuracy points for non-exact correct results', () => {
        assert.equal(scoreMatch(2, 0, 2, 1).total, 15)
        assert.equal(scoreMatch(3, 0, 4, 1).total, 14)
        assert.equal(scoreMatch(1, 0, 3, 1).total, 13)
        assert.equal(scoreMatch(1, 0, 4, 1).total, 12)
        assert.equal(scoreMatch(1, 0, 5, 1).total, 11)
        assert.equal(scoreMatch(1, 0, 6, 1).total, 10)
    })

    it('awards only the limited close-score bonus for draw vs win/loss mismatches', () => {
        const close = scoreMatch(1, 1, 2, 1)
        const wider = scoreMatch(1, 1, 3, 1)

        assert.equal(close.total, 8)
        assert.equal(close.type, 'partial')
        assert.deepEqual(close.breakdown, [
            { rule: 'Draw/win close-score bonus', pts: 5 },
            { rule: 'Both teams scored / clean sheet bonus', pts: 3 },
        ])
        assert.equal(wider.total, 3)
        assert.deepEqual(wider.breakdown, [
            { rule: 'Both teams scored / clean sheet bonus', pts: 3 },
        ])
    })

    it('awards no result or goal-accuracy points for a completely wrong winner', () => {
        const result = scoreMatch(2, 1, 1, 2)

        assert.equal(result.total, 3)
        assert.equal(result.type, 'partial')
        assert.deepEqual(result.breakdown, [
            { rule: 'Both teams scored / clean sheet bonus', pts: 3 },
        ])
    })

    it('awards BTTS and clean-sheet bonuses only for matching scoring patterns', () => {
        assert.equal(scoreMatch(2, 1, 3, 2).total, 17)
        assert.equal(scoreMatch(1, 0, 3, 0).total, 17)
        assert.equal(scoreMatch(0, 1, 3, 0).total, 0)
        assert.equal(scoreMatch(0, 0, 1, 0).total, 8)
    })

    it('adds knockout advancing-team points regardless of scoreline accuracy', () => {
        assert.equal(
            scoreMatch(2, 1, 2, 1, true, { predQualifier: 'ARG', realQualifier: 'ARG' }).total,
            35,
        )
        assert.equal(
            scoreMatch(2, 1, 1, 2, true, { predQualifier: 'ARG', realQualifier: 'ARG' }).total,
            13,
        )
    })

    it('adds only the knockout qualifier supplement when the advancing team is correct', () => {
        const result = scoreMatch(2, 1, 2, 1, true, {
            predQualifier: 'ARG',
            realQualifier: 'ARG',
        })

        assert.equal(result.total, 35)
        assert.deepEqual(result.breakdown, [
            { rule: 'Perfect prediction', pts: 25 },
            { rule: 'Correct advancing team (knockout)', pts: 10 },
        ])
    })
})
