import axios from 'axios';

// Base URLs from environment variables
const BETFAIR_API_BASE = import.meta.env.VITE_BETFAIR_API_BASE || 'http://localhost:3001/api';
const HEDGE_API_BASE = import.meta.env.VITE_HEDGE_API_BASE || 'http://localhost:10000/api';

// ========== BETFAIR API METHODS ==========

/**
 * Fetch live markets from Betfair API
 * @param {string} sport - Sport ID (default: '1' for soccer)
 * @returns {Array} Formatted market data
 */
export const fetchBetfairMarkets = async (sport = '1') => {
  try {
    console.log(`Fetching Betfair markets for sport ${sport}`);
    const response = await axios.get(`${BETFAIR_API_BASE}/betfair/live-markets`, {
      params: { sportId: sport }
    });
    
    console.log('Raw markets response:', response.data);
    
    // Handle error or empty response
    if (!response.data || (typeof response.data === 'object' && response.data.detail)) {
      console.warn('API returned error or empty data:', response.data);
      return [];
    }
    
    // Ensure we have an array
    if (!Array.isArray(response.data)) {
      console.warn('Expected array but got:', typeof response.data);
      return [];
    }
    
    // Transform the data into a consistent format
    return response.data.map(market => ({
      id: market.market_id,
      name: market.market_name,
      competition: market.competition || 'Unknown',
      event_name: market.event_name || '',
      team1: (market.event_name || '').split(' v ')[0] || 'Team 1',
      team2: (market.event_name || '').split(' v ')[1] || 'Team 2',
      startTime: market.start_time || new Date().toISOString(),
      isLive: true
    }));
  } catch (error) {
    console.error('Error fetching Betfair markets:', error);
    return []; // Return empty array on error
  }
};

/**
 * Fetch odds for a specific market
 * @param {string} marketId - Market ID to fetch odds for
 * @returns {Object} Market odds data with runners
 */
export const fetchMarketOdds = async (marketId) => {
  try {
    console.log(`Fetching odds for market ${marketId}`);
    const response = await axios.get(`${BETFAIR_API_BASE}/betfair/market-odds/${marketId}`);
    
    console.log('Raw odds response:', response.data);
    
    // Handle error or invalid response
    if (!response.data || typeof response.data !== 'object') {
      console.warn('Invalid response format:', response.data);
      return { market_id: marketId, runners: [] };
    }
    
    // Handle error message in response
    if (response.data.detail) {
      console.warn('API returned error:', response.data.detail);
      return { market_id: marketId, runners: [] };
    }
    
    // Ensure runners is an array
    if (!response.data.runners || !Array.isArray(response.data.runners)) {
      console.warn('No runners array in response');
      response.data.runners = [];
    }
    
    return response.data;
  } catch (error) {
    console.error(`Error fetching odds for market ${marketId}:`, error);
    return { market_id: marketId, runners: [] };
  }
};

/**
 * Find hedge opportunities for a specific market
 * @param {string} marketId - Market ID
 * @param {Array} runners - Array of runner objects with odds
 * @returns {Object} Hedge opportunities for the market
 */
export const findHedgeOpportunities = async (marketId, runners) => {
  try {
    console.log(`Finding hedge opportunities for market ${marketId}`);
    const response = await axios.post(`${BETFAIR_API_BASE}/hedge-opportunities`, {
      market_id: marketId,
      runners: runners
    });
    
    console.log('Hedge opportunities response:', response.data);
    
    // Ensure the response has the right structure
    if (!response.data || !response.data.hedge_opportunities) {
      return { market_id: marketId, hedge_opportunities: [] };
    }
    
    return response.data;
  } catch (error) {
    console.error('Error finding hedge opportunities:', error);
    return { market_id: marketId, hedge_opportunities: [] };
  }
};

// ========== HEDGE CALCULATION METHODS ==========

/**
 * Calculate hedge bet details
 * @param {number} backOdds - Back odds
 * @param {number} layOdds - Lay odds
 * @param {number} stake - Initial stake amount
 * @returns {Object} Hedge bet calculations
 */
export const calculateHedgeBet = (backOdds, layOdds, stake) => {
  if (!backOdds || !layOdds || !stake || backOdds <= 0 || layOdds <= 0 || stake <= 0) {
    return {
      valid: false,
      message: "Please enter valid positive numbers for all fields"
    };
  }
  
  // Calculate back bet winnings
  const backWinnings = stake * backOdds - stake;
  
  // Calculate lay stake needed to hedge
  const layStake = (stake * backOdds) / layOdds;
  
  // Calculate lay liability
  const layLiability = (layOdds - 1) * layStake;
  
  // Calculate profit scenarios
  const profitIfBackWins = backWinnings - layLiability;
  const profitIfLayWins = layStake - stake;
  
  // Determine if this is a guaranteed profit opportunity
  const isGuaranteedProfit = profitIfBackWins > 0 && profitIfLayWins > 0;
  
  return {
    valid: true,
    backOdds,
    layOdds,
    stake,
    layStake: parseFloat(layStake.toFixed(2)),
    layLiability: parseFloat(layLiability.toFixed(2)),
    profitIfBackWins: parseFloat(profitIfBackWins.toFixed(2)),
    profitIfLayWins: parseFloat(profitIfLayWins.toFixed(2)),
    isGuaranteedProfit
  };
};

// ========== LEGACY API METHODS (KEPT FOR COMPATIBILITY) ==========

/**
 * Fetch hedging opportunities from legacy API
 * @param {string} sport - Sport filter
 * @returns {Array} Hedge opportunities
 */
export const fetchHedgeOpportunities = async (sport = 'all') => {
  try {
    const response = await axios.get(`${HEDGE_API_BASE}/hedge-opportunities`, {
      params: { 
        sport,
        min_profit: -5 // Include opportunities with small losses too
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error fetching hedge opportunities:', error);
    return [];
  }
};

/**
 * Attempt authentication with Betfair
 * @returns {boolean} Success status
 */
export const authenticateBetfair = async () => {
  try {
    // Check the health endpoint which includes login status
    const response = await axios.get(`${BETFAIR_API_BASE}/health`);
    return response.data.betfair_logged_in === true;
  } catch (error) {
    console.error('Error authenticating with Betfair:', error);
    return false;
  }
};

// Additional helper methods can be added here as needed