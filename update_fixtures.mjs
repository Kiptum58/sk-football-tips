import fs from 'node:fs';

const env = fs.readFileSync('.env', 'utf8');
const apiKey = env.match(/^FOOTBALL_API_KEY=(.+)$/m)?.[1]?.trim();

if (!apiKey) {
  console.error('API key missing from .env');
  process.exit(1);
}

const response = await fetch(
  'https://api.footballapi.org/v1/fixtures?competition=premier-league&per_page=20',
  { headers: { 'X-API-Key': apiKey } }
);

if (!response.ok) {
  console.error('API request failed:', response.status);
  process.exit(1);
}

const result = await response.json();

if (!Array.isArray(result.data) || result.data.length === 0) {
  console.error('No valid fixtures returned. Existing data preserved.');
  process.exit(1);
}

const fixtures = result.data.map(match => ({
  id: match.match_id,
  home: match.home_club_name,
  away: match.away_club_name,
  kickoff: match.kickoff_utc,
  status: match.match_status,
  homeGoals: match.home_goals,
  awayGoals: match.away_goals
}));

const output = 'export const fixtures = ' +
  JSON.stringify(fixtures, null, 2) + ';\n';

fs.writeFileSync('fixtures.ts', output);

console.log('Successfully refreshed', fixtures.length, 'fixtures.');
