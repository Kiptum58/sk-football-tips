import fs from 'node:fs';

const history = JSON.parse(
  fs.readFileSync(new URL('./historical_results.json', import.meta.url), 'utf8')
);

const SHRINKAGE = 5;
const MAX_GOALS = 8;

function average(values) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function poisson(lambda) {
  const probabilities = [Math.exp(-lambda)];

  for (let i = 1; i <= MAX_GOALS; i++) {
    probabilities[i] = probabilities[i - 1] * lambda / i;
  }

  const total = probabilities.reduce((a, b) => a + b, 0);
  return probabilities.map(value => value / total);
}

function percent(value) {
  return Number((value * 100).toFixed(1));
}

function predictMatch(fixture, teams, leagueHomeAvg, leagueAwayAvg) {
  const home = teams.get(fixture.home);
  const away = teams.get(fixture.away);

  if (!home || !away || home.matches.length < 6 || away.matches.length < 6) {
    return {
      id: fixture.id,
      home: fixture.home,
      away: fixture.away,
      status: 'insufficient_data',
      reason: 'Not enough historical matches for both teams'
    };
  }

  function venueRate(team, venue, field, overallRate) {
    const relevant = team.matches.filter(match => match.venue === venue);
    const values = relevant.map(match => match[field]);

    return (
      (values.reduce((a, b) => a + b, 0) + SHRINKAGE * overallRate) /
      (values.length + SHRINKAGE)
    );
  }

  const homeAttack = venueRate(home, 'home', 'scored', home.scored / home.matches.length);
  const homeDefence = venueRate(home, 'home', 'conceded', home.conceded / home.matches.length);

  const awayAttack = venueRate(away, 'away', 'scored', away.scored / away.matches.length);
  const awayDefence = venueRate(away, 'away', 'conceded', away.conceded / away.matches.length);

  const expectedHome = Math.max(
    0.15,
    Math.min(4.5, leagueHomeAvg * homeAttack / leagueHomeAvg * awayDefence / leagueHomeAvg)
  );

  const expectedAway = Math.max(
    0.15,
    Math.min(4.5, leagueAwayAvg * awayAttack / leagueAwayAvg * homeDefence / leagueAwayAvg)
  );

  const homeGoals = poisson(expectedHome);
  const awayGoals = poisson(expectedAway);

  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let over25 = 0;
  let under25 = 0;
  let bttsYes = 0;
  let bttsNo = 0;

  for (let h = 0; h <= MAX_GOALS; h++) {
    for (let a = 0; a <= MAX_GOALS; a++) {
      const probability = homeGoals[h] * awayGoals[a];

      if (h > a) homeWin += probability;
      else if (h === a) draw += probability;
      else awayWin += probability;

      if (h + a > 2) over25 += probability;
      else under25 += probability;

      if (h > 0 && a > 0) bttsYes += probability;
      else bttsNo += probability;
    }
  }

  const total = homeWin + draw + awayWin;

  homeWin /= total;
  draw /= total;
  awayWin /= total;

  return {
    id: fixture.id,
    home: fixture.home,
    away: fixture.away,
    kickoff: fixture.kickoff,
    status: 'predicted',
    model: 'Poisson goals model',
    sample: {
      homeMatches: home.matches.length,
      awayMatches: away.matches.length
    },
    dataQuality: 'Limited sample - 9 matches per team',
    expectedGoals: {
      home: Number(expectedHome.toFixed(2)),
      away: Number(expectedAway.toFixed(2))
    },
    markets: {
      '1X2': {
        home: percent(homeWin),
        draw: percent(draw),
        away: percent(awayWin)
      },
      'Over/Under 2.5': {
        over: percent(over25),
        under: percent(under25)
      },
      'Both Teams To Score': {
        yes: percent(bttsYes),
        no: percent(bttsNo)
      },
      'Double Chance': {
        '1X': percent(homeWin + draw),
        'X2': percent(draw + awayWin),
        '12': percent(homeWin + awayWin)
      }
    }
  };
}

export function generatePredictions(fixtures) {
  const matches = history.filter(match =>
    match.competition === 'premier-league' &&
    match.season_start_year === 2026 &&
    match.match_status === 'finished' &&
    Number.isFinite(match.home_goals) &&
    Number.isFinite(match.away_goals)
  );

  const teams = new Map();

  function addTeam(name) {
    if (!teams.has(name)) {
      teams.set(name, {
        matches: [],
        scored: 0,
        conceded: 0
      });
    }
    return teams.get(name);
  }

  for (const match of matches) {
    const home = addTeam(match.home_club_name);
    const away = addTeam(match.away_club_name);

    home.matches.push({
      venue: 'home',
      scored: match.home_goals,
      conceded: match.away_goals
    });

    away.matches.push({
      venue: 'away',
      scored: match.away_goals,
      conceded: match.home_goals
    });

    home.scored += match.home_goals;
    home.conceded += match.away_goals;

    away.scored += match.away_goals;
    away.conceded += match.home_goals;
  }

  const leagueHomeAvg = average(matches.map(m => m.home_goals));
  const leagueAwayAvg = average(matches.map(m => m.away_goals));

  return {
    model: 'SK Statistical Prediction Engine v1',
    method: 'Poisson distribution with venue-based shrinkage',
    historicalMatches: matches.length,
    leagueAverageGoals: Number((leagueHomeAvg + leagueAwayAvg).toFixed(2)),
    warning: 'Probabilities are estimates, not guarantees. Historical sample is limited.',
    count: fixtures.length,
    predictions: fixtures.map(fixture =>
      predictMatch(fixture, teams, leagueHomeAvg, leagueAwayAvg)
    )
  };
}
