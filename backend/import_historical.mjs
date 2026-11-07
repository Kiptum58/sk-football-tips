import fs from 'node:fs';

const folder = new URL('./historical_csv/', import.meta.url);
const original = JSON.parse(
  fs.readFileSync(new URL('./historical_results.json', import.meta.url), 'utf8')
);

const seasons = [
  { file: 'E0_2324.csv', year: 2023 },
  { file: 'E0_2425.csv', year: 2024 },
  { file: 'E0_2526.csv', year: 2025 }
];

const aliases = {
  'Man City': 'Manchester City',
  'Man United': 'Manchester United',
  "Nott'm Forest": 'Nottingham Forest',
  'Wolves': 'Wolverhampton Wanderers'
};

function teamName(name) {
  return aliases[name] || name;
}

function toUtc(date, time) {
  const [day, month, year] = date.split('/').map(Number);
  const [hour, minute] = time.split(':').map(Number);

  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute);

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(localAsUtc))
      .filter(p => p.type !== 'literal')
      .map(p => [p.type, Number(p.value)])
  );

  const representedUtc = Date.UTC(
    parts.year, parts.month - 1, parts.day,
    parts.hour, parts.minute, parts.second
  );

  const offset = representedUtc - localAsUtc;

  return new Date(localAsUtc - offset).toISOString();
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

const imported = [];

for (const season of seasons) {
  const content = fs.readFileSync(
    new URL(season.file, folder),
    'utf8'
  ).replace(/^\uFEFF/, '');

  const lines = content.trim().split(/\r?\n/);
  const headers = lines[0].split(',').map(x => x.trim());

  const index = name => headers.indexOf(name);

  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;

    const row = line.split(',').map(x => x.trim());

    const date = row[index('Date')];
    const time = row[index('Time')];
    const rawHome = row[index('HomeTeam')];
    const rawAway = row[index('AwayTeam')];
    const homeGoals = Number(row[index('FTHG')]);
    const awayGoals = Number(row[index('FTAG')]);
    const result = row[index('FTR')];

    if (
      !date || !time || !rawHome || !rawAway ||
      !Number.isFinite(homeGoals) ||
      !Number.isFinite(awayGoals) ||
      !['H', 'D', 'A'].includes(result)
    ) continue;

    const [day, month, shortYear] = date.split('/');
    const year = Number(shortYear.length === 4 ? shortYear : (Number(shortYear) < 70 ? 2000 + Number(shortYear) : 1900 + Number(shortYear)));

    const home = teamName(rawHome);
    const away = teamName(rawAway);
    const kickoff = toUtc(
      `${day}/${month}/${year}`,
      time
    );

    const matchResult = result === 'H'
      ? 'home'
      : result === 'D' ? 'draw' : 'away';

    imported.push({
      match_id: `fd_${season.year}_${slug(home)}_${slug(away)}_${day}${month}`,
      competition: 'premier-league',
      country_name: 'England',
      competition_name: 'Premier League',
      season_start_year: season.year,
      kickoff_utc: kickoff,
      kickoff_date: `${year}-${month}-${day}`,
      kickoff_local_date: `${year}-${month}-${day}`,
      kickoff_local_time: time,
      match_status: 'finished',
      home_club_id: `hist_${slug(home)}`,
      home_club_name: home,
      away_club_id: `hist_${slug(away)}`,
      away_club_name: away,
      home_goals: homeGoals,
      away_goals: awayGoals,
      full_time_result: matchResult,
      half_time_home_goals: null,
      half_time_away_goals: null,
      half_time_result: null,
      stoppage_minutes: null,
      is_kickoff_rescheduled: null,
      elapsed_minutes: null,
      home_league_position: null,
      away_league_position: null,
      away_travel_km: null,
      ground_name: null,
      city_name: null,
      latitude: null,
      longitude: null,
      location_precision: null,
      daylight_minutes: null,
      sun_elevation_deg: null,
      public_holiday: null,
      kickoff_temperature_c: null,
      kickoff_rain_mm: null,
      kickoff_wind_ms: null,
      attendance: null,
      referee_name: null,
      regular_time_home_goals: homeGoals,
      regular_time_away_goals: awayGoals,
      regular_time_result: matchResult,
      extra_time_home_goals: null,
      extra_time_away_goals: null,
      shootout_home_goals: null,
      shootout_away_goals: null,
      stats_status: 'not_available',
      club_figures: null,
      stats_reason: 'Historical CSV archive'
    });
  }
}

const combined = [...original, ...imported].sort(
  (a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc)
);

fs.writeFileSync(
  new URL('./historical_results_expanded.json', import.meta.url),
  JSON.stringify(combined, null, 2)
);

console.log('HISTORICAL IMPORT COMPLETE');
console.log('Original matches:', original.length);
console.log('Imported matches:', imported.length);
console.log('Combined matches:', combined.length);
console.log(
  'Imported seasons:',
  [...new Set(imported.map(m => m.season_start_year))].join(', ')
);
console.log(
  'Date range:',
  combined[0]?.kickoff_date,
  'to',
  combined[combined.length - 1]?.kickoff_date
);
