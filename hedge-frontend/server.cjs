const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const https = require('https');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors({ origin: 'http://localhost:5173' })); // Allow Vite origin

const certOptions = {
  cert: fs.readFileSync(process.env.BETFAIR_CERT_PATH),
  key: fs.readFileSync(process.env.BETFAIR_KEY_PATH)
};

let sessionToken = null;

app.post('/api/betfair-auth', async (req, res) => {
  try {
    const response = await fetch('https://identitysso-cert.betfair.com/api/certlogin', {
      method: 'POST',
      headers: {
        'X-Application': process.env.BETFAIR_APP_KEY,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `username=${encodeURIComponent(process.env.BETFAIR_USERNAME)}&password=${encodeURIComponent(process.env.BETFAIR_PASSWORD)}`,
      agent: new https.Agent(certOptions)
    });
    const data = await response.json();
    if (data.loginStatus === 'SUCCESS') {
      sessionToken = data.sessionToken;
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/markets', async (req, res) => {
  if (!sessionToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    const response = await fetch('https://api.betfair.com/exchange/betting/json-rpc/v1', {
      method: 'POST',
      headers: {
        'X-Application': process.env.BETFAIR_APP_KEY,
        'X-Authentication': sessionToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'SportsAPING/v1.0/listMarketCatalogue',
        params: {
          filter: { eventTypeIds: ['1'] }, // Soccer
          maxResults: '10',
          marketProjection: ['MARKET_DESCRIPTION', 'RUNNER_DESCRIPTION']
        },
        id: 1
      })
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/odds', async (req, res) => {
  if (!sessionToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    const marketId = '1.229569552'; // Real ID: Winner 2024/25
    const response = await fetch('https://api.betfair.com/exchange/betting/json-rpc/v1', {
      method: 'POST',
      headers: {
        'X-Application': process.env.BETFAIR_APP_KEY,
        'X-Authentication': sessionToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'SportsAPING/v1.0/listMarketBook',
        params: {
          marketIds: [marketId],
          priceProjection: { priceData: ['EX_BEST_OFFERS'] }
        },
        id: 1
      })
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(process.env.PORT, () => console.log(`Server on port ${process.env.PORT}`));