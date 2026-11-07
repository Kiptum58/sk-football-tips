import fs from 'node:fs';

const history = JSON.parse(
  fs.readFileSync(
    new URL('./historical_results_expanded.json', import.meta.url),
    'utf8'
  )
)
.filter(m =>
  m.competition === 'premier-league' &&
  m.match_status === 'finished' &&
  Number.isFinite(m.home_goals) &&
  Number.isFinite(m.away_goals) &&
  m.kickoff_utc
)
.sort((a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc));

const INITIAL_RATING = 1500;
const K_FACTOR = 20;
const HOME_ADVANTAGE = 60;
const DRAW_FACTOR = 0.8;
const MIN_MATCHES = 6;
const BASELINE_PRIOR = 1;

function getRating(ratings, team) {
  return ratings.get(team) ?? INITIAL_RATING;
}

function predictElo(homeRating, awayRating) {
  const homeStrength = Math.pow(
    10,
    (homeRating + HOME_ADVANTAGE - awayRating) / 400
  );

  const awayStrength = Math.pow(
    10,
    (awayRating - homeRating - HOME_ADVANTAGE) / 400
  );

  const total = homeStrength + awayStrength + DRAW_FACTOR;

  return [
    homeStrength / total,
    DRAW_FACTOR / total,
    awayStrength / total
  ];
}

function outcome(match) {
  if (match.home_goals > match.away_goals) return 0;
  if (match.home_goals === match.away_goals) return 1;
  return 2;
}

function actualScore(match) {
  if (match.home_goals > match.away_goals) return 1;
  if (match.home_goals === match.away_goals) return 0.5;
  return 0;
}

function updateRatings(ratings, home, away, probabilities, score) {
  const expectedScore = probabilities[0] + 0.5 * probabilities[1];
  const change = K_FACTOR * (score - expectedScore);

  ratings.set(home, getRating(ratings, home) + change);
  ratings.set(away, getRating(ratings, away) - change);
}

function evaluate(results) {
  if (!results.length) return null;

  let correct = 0;
  let logLoss = 0;
  let brier = 0;

  for (const r of results) {
    const actual = r.actual;
    const prediction = r.probabilities;

    if (prediction.indexOf(Math.max(...prediction)) === actual) {
      correct++;
    }

    logLoss -= Math.log(Math.max(prediction[actual], 1e-15));

    for (let i = 0; i < 3; i++) {
      brier += Math.pow(
        prediction[i] - (i === actual ? 1 : 0),
        2
      );
    }
  }

  return {
    matches: results.length,
    accuracy: (correct / results.length * 100).toFixed(1) + '%',
    logLoss: (logLoss / results.length).toFixed(4),
    brierScore: (brier / results.length).toFixed(4)
  };
}

const ratings = new Map();
const matchesPlayed = new Map();
const outcomeCounts = [0, 0, 0];
const eloResults = [];
const baselineResults = [];

let skipped = 0;
let index = 0;

while (index < history.length) {
  const kickoff = history[index].kickoff_utc;
  let end = index + 1;

  while (
    end < history.length &&
    history[end].kickoff_utc === kickoff
  ) {
    end++;
  }

  const group = history.slice(index, end);
  const predictions = [];

  for (const match of group) {
    const home = match.home_club_name;
    const away = match.away_club_name;

    if (
      (matchesPlayed.get(home) ?? 0) < MIN_MATCHES ||
      (matchesPlayed.get(away) ?? 0) < MIN_MATCHES
    ) {
      skipped++;
      continue;
    }

    const probabilities = predictElo(
      getRating(ratings, home),
      getRating(ratings, away)
    );

    const baselineTotal = outcomeCounts.reduce(
      (sum, count) => sum + count,
      0
    );

    const baseline = outcomeCounts.map(
      count =>
        (count + BASELINE_PRIOR) /
        (baselineTotal + 3 * BASELINE_PRIOR)
    );

    predictions.push({
      match,
      probabilities,
      baseline
    });
  }

  for (const item of predictions) {
    const actual = outcome(item.match);

    eloResults.push({
      actual,
      probabilities: item.probabilities,
      season: Number(item.match.season_start_year)
    });

    baselineResults.push({
      actual,
      probabilities: item.baseline
    });
  }

  for (const match of group) {
    const home = match.home_club_name;
    const away = match.away_club_name;

    const probabilities = predictElo(
      getRating(ratings, home),
      getRating(ratings, away)
    );

    updateRatings(
      ratings,
      home,
      away,
      probabilities,
      actualScore(match)
    );

    matchesPlayed.set(home, (matchesPlayed.get(home) ?? 0) + 1);
    matchesPlayed.set(away, (matchesPlayed.get(away) ?? 0) + 1);

    outcomeCounts[outcome(match)]++;
  }

  index = end;
}

console.log('\nSK FOOTBALL TIPS - ELO WALK-FORWARD BACKTEST');
console.log('============================================');
console.log('Historical matches:', history.length);
console.log('Tested matches:', eloResults.length);
console.log('Skipped matches:', skipped);

console.log('\nELO MODEL');
console.log(evaluate(eloResults) || 'Not enough test matches');

console.log('\nHISTORICAL BASELINE');
console.log(evaluate(baselineResults) || 'Not enough test matches');

console.log('\nSEASON-BY-SEASON ELO RESULTS');

for (const season of [...new Set(eloResults.map(r => r.season))].sort()) {
  const results = eloResults.filter(r => r.season === season);
  console.log('Season', season, evaluate(results));
}

console.log('\nLower log loss and Brier score are better.');
console.log('Historical results are not guarantees of future performance.');
