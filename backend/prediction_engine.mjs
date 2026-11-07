import fs from 'node:fs';

const history = JSON.parse(
  fs.readFileSync(new URL('./historical_results_expanded.json', import.meta.url), 'utf8')
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
const HALF_LIFE_DAYS = 365;

function recencyWeight(matchDate, referenceDate) {
  const ageDays = (referenceDate - new Date(matchDate)) / 86400000;
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

function poisson(lambda) {
  const p = [Math.exp(-lambda)];
  for (let i = 1; i <= MAX_GOALS; i++) {
    p[i] = p[i - 1] * lambda / i;
  }
  const total = p.reduce((a, b) => a + b, 0);
  return p.map(x => x / total);
}

function percent(value) {
  return Number((value * 100).toFixed(1));
}

function buildTeams(matches, referenceDate) {
  const teams = new Map();

  function getTeam(name) {
    if (!teams.has(name)) {
      teams.set(name, {
        matches: [],
        scored: 0,
        conceded: 0,
        weightTotal: 0
      });
    }
    return teams.get(name);
  }

  for (const m of matches) {
    const weight = recencyWeight(m.kickoff_utc, referenceDate);
    const home = getTeam(m.home_club_name);
    const away = getTeam(m.away_club_name);

    home.matches.push({
      venue: 'home', weight,
      scored: m.home_goals,
      conceded: m.away_goals
    });

    away.matches.push({
      venue: 'away', weight,
      scored: m.away_goals,
      conceded: m.home_goals
    });

    home.scored += m.home_goals * weight;
    home.conceded += m.away_goals * weight;
    away.scored += m.away_goals * weight;
    away.conceded += m.home_goals * weight;
    home.weightTotal += weight;
    away.weightTotal += weight;
  }

  return teams;
}

function predictMatch(fixture, teams, leagueHomeAvg, leagueAwayAvg) {
  const home = teams.get(fixture.home);
  const away = teams.get(fixture.away);

  if (!home || !away || home.matches.length < 6 || away.matches.length < 6) {
    return {
      id: fixture.id,
      home: fixture.home,
      away: fixture.away,
      kickoff: fixture.kickoff,
      status: 'insufficient_data',
      reason: 'Not enough historical matches for both teams'
    };
  }

  function venueRate(team, venue, field, overall) {
    const relevant = team.matches.filter(m => m.venue === venue);
    const total = relevant.reduce((sum, m) => sum + m[field] * m.weight, 0);
    const totalWeight = relevant.reduce((sum, m) => sum + m.weight, 0);
    return (total + SHRINKAGE * overall) / (totalWeight + SHRINKAGE);
  }

  const homeAttack = venueRate(home, 'home', 'scored', home.scored / home.weightTotal);
  const homeDefence = venueRate(home, 'home', 'conceded', home.conceded / home.weightTotal);
  const awayAttack = venueRate(away, 'away', 'scored', away.scored / away.weightTotal);
  const awayDefence = venueRate(away, 'away', 'conceded', away.conceded / away.weightTotal);

  const expectedHome = Math.max(0.15, Math.min(4.5, homeAttack * awayDefence / leagueHomeAvg));
  const expectedAway = Math.max(0.15, Math.min(4.5, awayAttack * homeDefence / leagueAwayAvg));

  const hp = poisson(expectedHome);
  const ap = poisson(expectedAway);

  let homeWin = 0, draw = 0, awayWin = 0;
  let over25 = 0, under25 = 0, bttsYes = 0, bttsNo = 0;

  for (let h = 0; h <= MAX_GOALS; h++) {
    for (let a = 0; a <= MAX_GOALS; a++) {
      const p = hp[h] * ap[a];

      if (h > a) homeWin += p;
      else if (h === a) draw += p;
      else awayWin += p;

      if (h + a > 2) over25 += p;
      else under25 += p;

      if (h > 0 && a > 0) bttsYes += p;
      else bttsNo += p;
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
    model: '365-day Recency-Weighted Poisson',
    sample: {
      homeMatches: home.matches.length,
      awayMatches: away.matches.length
    },
    dataQuality: 'Historical results weighted by recency',
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
  const predictions = fixtures.map(fixture => {
    const referenceDate = new Date(fixture.kickoff);

    if (!Number.isFinite(referenceDate.getTime())) {
      return {
        id: fixture.id,
        home: fixture.home,
        away: fixture.away,
        kickoff: fixture.kickoff,
        status: 'insufficient_data',
        reason: 'Invalid fixture kickoff date'
      };
    }

    const previous = history.filter(
      match => new Date(match.kickoff_utc) < referenceDate
    );

    if (!previous.length) {
      return {
        id: fixture.id,
        home: fixture.home,
        away: fixture.away,
        kickoff: fixture.kickoff,
        status: 'insufficient_data',
        reason: 'No earlier historical matches available'
      };
    }

    const reference = referenceDate;
    const teams = buildTeams(previous, reference);

    let weightedHome = 0;
    let weightedAway = 0;
    let totalWeight = 0;

    for (const match of previous) {
      const weight = recencyWeight(match.kickoff_utc, reference);
      weightedHome += match.home_goals * weight;
      weightedAway += match.away_goals * weight;
      totalWeight += weight;
    }

    const leagueHomeAvg = weightedHome / totalWeight;
    const leagueAwayAvg = weightedAway / totalWeight;

    if (!leagueHomeAvg || !leagueAwayAvg) {
      return {
        id: fixture.id,
        home: fixture.home,
        away: fixture.away,
        kickoff: fixture.kickoff,
        status: 'insufficient_data',
        reason: 'Insufficient league scoring data'
      };
    }

    return predictMatch(fixture, teams, leagueHomeAvg, leagueAwayAvg);
  });

  return {
    model: 'SK Statistical Prediction Engine v2',
    method: '365-day recency-weighted Poisson with venue-based shrinkage',
    historicalMatches: history.length,
    warning: 'Probabilities are estimates, not guarantees. Historical sample is limited.',
    count: fixtures.length,
    predictions
  };
}
