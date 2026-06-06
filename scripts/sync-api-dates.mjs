import { readFileSync, writeFileSync } from 'fs'

const apiData = JSON.parse(readFileSync('./api-matches.json', 'utf8'))
let dataFile = readFileSync('src/lib/wc2026-data.ts', 'utf8')

let matchCount = 0

for (const match of apiData) {
    if (match.stage === 'GROUP_STAGE' && match.homeTeam.tla && match.awayTeam.tla) {
        const home = match.homeTeam.tla
        const away = match.awayTeam.tla
        const date = match.utcDate
        
        // Find this match in the dataFile and replace its kickoff
        // The regex looks for home_team and away_team and updates kickoff
        const regex = new RegExp(`("home_team": "${home}",[\\s\\S]*?"away_team": "${away}",[\\s\\S]*?"kickoff": ")[^"]+(")`)
        
        dataFile = dataFile.replace(regex, (matchStr, p1, p2) => {
            matchCount++
            return p1 + date + p2
        })
    }
}

writeFileSync('src/lib/wc2026-data.ts', dataFile)
console.log(`Updated ${matchCount} group stage dates from API.`)
