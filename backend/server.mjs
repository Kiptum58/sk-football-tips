import http from 'node:http';
import fs from 'node:fs';
import { generatePredictions } from './prediction_engine.mjs';

const PORT = process.env.PORT || 3000;

function getApiKey() {
  return process.env.FOOTBALL_API_KEY?.trim();
}

let cachedFixtures = null;
let lastFetch = 0;
const CACHE_DURATION = 10 * 60 * 1000;

const server = http.createServer(async (req, res) => {
  console.log('INCOMING REQUEST:', req.method, req.url);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'GET') {
    res.writeHead(405);
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  if (req.url === '/health') {
    res.writeHead(200);
    return res.end(JSON.stringify({ status: 'Backend is running' }));
  }

  if (req.url !== '/fixtures' && req.url !== '/predictions') {
    res.writeHead(404);
    return res.end(JSON.stringify({ error: 'Route not found' }));
  }

  try {
    if (
      !cachedFixtures ||
      Date.now() - lastFetch > CACHE_DURATION
    ) {
      const apiKey = getApiKey();

      if (!apiKey) {
        throw new Error('API key is missing');
      }

      const response = await fetch(
        'https://api.footballapi.org/v1/fixtures?competition=premier-league&per_page=20',
        { headers: { 'X-API-Key': apiKey } }
      );

      if (!response.ok) {
        throw new Error(`Football API error: ${response.status}`);
      }

      const result = await response.json();

      if (!Array.isArray(result.data)) {
        throw new Error('Invalid fixture data');
      }

      cachedFixtures = result.data.map(match => ({
        id: match.match_id,
        home: match.home_club_name,
        away: match.away_club_name,
        kickoff: match.kickoff_utc,
        status: match.match_status,
        homeGoals: match.home_goals,
        awayGoals: match.away_goals
      }));

      lastFetch = Date.now();
    }

    if (req.url === '/predictions') {
      const predictions = generatePredictions(cachedFixtures);

      res.writeHead(200);
      return res.end(JSON.stringify(predictions));
    }

    res.writeHead(200);
    res.end(JSON.stringify({
      count: cachedFixtures.length,
      fixtures: cachedFixtures
    }));
  }
  catch (error) {
    console.error(error.message);
    res.writeHead(502);
    res.end(JSON.stringify({
      error: 'Unable to retrieve football data'
    }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`SK Football Tips backend running on port ${PORT}`);
});
