import fs from 'node:fs';

const history = JSON.parse(
  fs.readFileSync(new URL('./historical_results.json', import.meta.url), 'utf8')
)
.filter(m =>
  m.competition === 'premier-league' &&
  m.match_status === 'finished' &&
  Number.isFinite(m.home_goals) &&
  Number.isFinite(m.away_goals) &&
  m.kickoff_utc
)
.sort((a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc));

const SHRINKAGE = 5;
const MAX_GOALS = 8;

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function poisson(lambda) {
  const p = [Math.exp(-lambda)];

  for (let i = 1; i <= MAX_GOALS; i++) {
    p[i] = p[i - 1] * lambda / i;
  }

  const total = p.reduce((a, b) => a + b, 0);
  return p.map(x => x / total);
}

function buildTeams(matches) {
  const teams = new Map();

  function getTeam(name) {
    if (!teams.has(name)) {
      teams.set(name, {
        matches: [],
        scored: 0,
        conceded: 0
      });
    }
    return teams.get(name);
  }

  for (const m of matches) {
    const home = getTeam(m.home_club_name);
    const away = getTeam(m.away_club_name);

    home.matches.push({
      venue: 'home',
      scored: m.home_goals,
      conceded: m.away_goals
    });

    away.matches.push({
      venue: 'away',
      scored: m.away_goals,
      conceded: m.home_goals
    });

    home.scored += m.home_goals;
    home.conceded += m.away_goals;
    away.scored += m.away_goals;
    away.conceded += m.home_goals;
  }

  return teams;
}

function predict(home, away, teams, leagueHomeAvg, leagueAwayAvg) {
  const h = teams.get(home);
  const a = teams.get(away);

  if (!h || !a || h.matches.length < 6 || a.matches.length < 6) {
    return null;
  }

  function venueRate(team, venue, field, overall) {
    const relevant = team.matches.filter(m => m.venue === venue);
    const total = relevant.reduce((sum, m) => sum + m[field], 0);

    return (total + SHRINKAGE * overall) /
      (relevant.length + SHRINKAGE);
  }

  const homeAttack = venueRate(
    h, 'home', 'scored', h.scored / h.matches.length
  );

  const homeDefence = venueRate(
    h, 'home', 'conceded', h.conceded / h.matches.length
  );

  const awayAttack = venueRate(
    a, 'away', 'scored', a.scored / a.matches.length
  );

  const awayDefence = venueRate(
    a, 'away', 'conceded', a.conceded / a.matches.length
  );

  const expectedHome = Math.max(
    0.15,
    Math.min(4.5, homeAttack * awayDefence / leagueHomeAvg)
  );

  const expectedAway = Math.max(
    0.15,
    Math.min(4.5, awayAttack * homeDefence / leagueAwayAvg)
  );

  const hp = poisson(expectedHome);
  const ap = poisson(expectedAway);

  const probabilities = [0, 0, 0];

  for (let x = 0; x <= MAX_GOALS; x++) {
    for (let y = 0; y <= MAX_GOALS; y++) {
      const p = hp[x] * ap[y];

      if (x > y) probabilities[0] += p;
      else if (x === y) probabilities[1] += p;
      else probabilities[2] += p;
    }
  }

  const total = probabilities.reduce((sum, p) => sum + p, 0);
  return probabilities.map(p => p / total);
}

function outcome(m) {
  if (m.home_goals > m.away_goals) return 0;
  if (m.home_goals === m.away_goals) return 1;
  return 2;
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
      brier += Math.pow(prediction[i] - (i === actual ? 1 : 0), 2);
    }
  }

  return {
    matches: results.length,
    accuracy: (correct / results.length * 100).toFixed(1) + '%',
    logLoss: (logLoss / results.length).toFixed(4),
    brierScore: (brier / results.length).toFixed(4)
  };
}

const modelResults = [];
const baselineResults = [];
let skipped = 0;

for (const match of history) {
  const previous = history.filter(
    m => m.kickoff_utc < match.kickoff_utc
  );

  const teams = buildTeams(previous);

  const homeAvg = previous.length
    ? average(previous.map(m => m.home_goals))
    : 0;

  const awayAvg = previous.length
    ? average(previous.map(m => m.away_goals))
    : 0;

  if (!previous.length || homeAvg <= 0 || awayAvg <= 0) {
    skipped++;
    continue;
  }

  const probabilities = predict(
    match.home_club_name,
    match.away_club_name,
    teams,
    homeAvg,
    awayAvg
  );

  if (!probabilities) {
    skipped++;
    continue;
  }

  const actual = outcome(match);

  modelResults.push({ actual, probabilities });

    const baseline = [0, 0, 0];

  for (const m of previous) {
    baseline[outcome(m)]++;
  }

  const baselineTotal = baseline.reduce((a, b) => a + b, 0);
  const homeAdvantage = baseline.map(
    count => (count + 1) / (baselineTotal + 3)
  );

  baselineResults.push({
    actual,
    probabilities: homeAdvantage
  });
}

console.log('\nSK FOOTBALL TIPS - WALK-FORWARD BACKTEST');
console.log('========================================');
console.log('Historical matches:', history.length);
console.log('Tested matches:', modelResults.length);
console.log('Skipped matches:', skipped);
console.log('\nEXISTING POISSON MODEL');
console.log(evaluate(modelResults) || 'Not enough test matches');
console.log('\nHISTORICAL BASELINE');
console.log(evaluate(baselineResults) || 'Not enough test matches');
console.log('\nLower log loss and Brier score are better.');
console.log('Results are historical tests, not guarantees.');
