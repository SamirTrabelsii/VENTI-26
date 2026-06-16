const fs = require('fs');

async function fetchAndMap() {
    // Fetch all WC matches from football-data.org
    const res = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
        headers: { 'X-Auth-Token': '9e5e1c1b6fe5472d8c6507281ea107cb' }
    });
    const data = await res.json();
    const matches = data.matches || [];
    
    const finished = matches.filter(m => m.status === 'FINISHED');
    console.log(`Total: ${matches.length}, Finished: ${finished.length}, Live: ${matches.filter(m => m.status === 'IN_PLAY').length}`);
    console.log('\nFirst 5 finished:');
    finished.slice(0, 5).forEach(m => {
        console.log(`  API ID: ${m.id} | ${m.homeTeam.name} ${m.score.fullTime.home}-${m.score.fullTime.away} ${m.awayTeam.name} | Date: ${m.utcDate.split('T')[0]}`);
    });
    
    // Save full data so we can build the mapping
    fs.writeFileSync('api-matches-live.json', JSON.stringify(matches, null, 2));
    console.log('\nSaved to api-matches-live.json');
}

fetchAndMap().catch(console.error);
