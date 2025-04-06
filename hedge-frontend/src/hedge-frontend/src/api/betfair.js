import axios from 'axios';

const BETFAIR_API_BASE = import.meta.env.VITE_BETFAIR_API_BASE || 'http://localhost:3001/api/betfair';
const HEDGE_API_BASE = import.meta.env.VITE_HEDGE_API_BASE || 'http://localhost:3001/api';

export const fetchBetfairMarkets = async (sport = '1') => {
  try {
    const response = await axios.get(`${BETFAIR_API_BASE}/live-markets`, {
      params: { sport }
    });
    return response.data.map(market => ({
      id: market.market_id,
      name: market.market_name,
      competition: market.competition,
      team1: market.event_name.split(' v ')[0] || 'Home Team',
      team2: market.event_name.split(' v ')[1] || 'Away Team',
      startTime: market.start_time,
      isLive: true,
      odds1: 2.0,
      odds2: 2.1
    }));
  } catch (error) {
    console.error('Error fetching Betfair markets:', error);
    return [
      {
        id: 'market-1',
        name: 'Man City vs Liverpool',
        competition: 'Premier League',
        team1: 'Man City',
        team2: 'Liverpool',
        odds1: 1.95,
        odds2: 3.80,
        startTime: '2025-03-29 15:00:00',
        isLive: true
      }
    ];
  }
};

export const fetchMarketOdds = async (marketId) => {
  try {
    const response = await axios.get(`${BETFAIR_API_BASE}/market-odds/${marketId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching market odds:', error);
    return { market_id: marketId, runners: [] };
  }
};

export const calculateHedge = async (oddsData) => {
  try {
    const response = await axios.post(`${HEDGE_API_BASE}/hedge-opportunities`, oddsData);
    return response.data;
  } catch (error) {
    console.error('Error calculating hedge:', error);
    return { market_id: oddsData.market_id, hedge_opportunities: [] };
  }
};
