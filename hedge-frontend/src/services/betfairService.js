import axios from 'axios';

// Configuration
const BETFAIR_API_BASE = '/api/betfair'; // Define the base URL for Betfair API
const DEFAULT_TIMEOUT = 45000;  // 45s, covers ~32s fetch + buffer
const USE_MOCK_DATA = true;
const RETRY_COUNT = 2;
const MAX_LOG_ERRORS = 2;

// Mock data for when the API is unavailable
const MOCK_MARKETS = [
  { id: '1.241453321', name: 'Match Odds', event_name: 'Cambridge Utd v Wrexham', startTime: '2025-04-01T18:45:00', competition: 'English League 1', odds: [{ selection_id: '256400', runner_name: 'Cambridge Utd', best_back_price: 5.0, best_lay_price: 5.4, status: 'ACTIVE' }, { selection_id: '63604', runner_name: 'Wrexham', best_back_price: 1.88, best_lay_price: 1.89, status: 'ACTIVE' }, { selection_id: '58805', runner_name: 'The Draw', best_back_price: 3.6, best_lay_price: 3.7, status: 'ACTIVE' }] },
  { id: '1.241452331', name: 'Match Odds', event_name: 'Blackpool v Reading', startTime: '2025-04-01T18:45:00', competition: 'English League 1', odds: [{ selection_id: '64964', runner_name: 'Blackpool', best_back_price: 1.8, best_lay_price: 1.82, status: 'ACTIVE' }, { selection_id: '103122', runner_name: 'Reading', best_back_price: 5.2, best_lay_price: 5.3, status: 'ACTIVE' }, { selection_id: '58805', runner_name: 'The Draw', best_back_price: 3.8, best_lay_price: 3.95, status: 'ACTIVE' }] },
  { id: '1.241451341', name: 'Match Odds', event_name: 'Port Vale v Bradford', startTime: '2025-04-01T18:45:00', competition: 'English League 2', odds: [{ selection_id: '256373', runner_name: 'Port Vale', best_back_price: 2.74, best_lay_price: 3.0, status: 'ACTIVE' }, { selection_id: '48444', runner_name: 'Bradford', best_back_price: 2.94, best_lay_price: 3.05, status: 'ACTIVE' }, { selection_id: '58805', runner_name: 'The Draw', best_back_price: 3.0, best_lay_price: 3.3, status: 'ACTIVE' }] },
];

// Track backend status and error count
let backendStatus = 'unknown'; // 'online', 'offline', 'unknown'
let errorLogCount = 0;
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds between health checks

// Create axios instance with default config
const api = axios.create({
  baseURL: BETFAIR_API_BASE,
  timeout: DEFAULT_TIMEOUT,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
});

// Helper to check if backend is available
export const checkBackendHealth = async (force = false) => {
  // Don't hammer health endpoint if we've checked recently
  const now = Date.now();
  if (!force && now - lastHealthCheck < HEALTH_CHECK_INTERVAL) {
    return backendStatus === 'online';
  }
  
  lastHealthCheck = now;
  
  try {
    console.log(`Checking health at /api/health`);
    const response = await axios.get('/api/health', { timeout: 5000 });
    console.log('Backend health check successful:', response.data);
    backendStatus = 'online';
    errorLogCount = 0; // Reset error counter on success
    return true;
  } catch (error) {
    if (errorLogCount < MAX_LOG_ERRORS) {
      console.warn('Backend health check failed:', error.message);
      errorLogCount++;
    }
    backendStatus = 'offline';
    return false;
  }
};

// Get current backend status
export const getBackendStatus = () => backendStatus;

// Main function to fetch markets with retry logic
export const fetchBetfairMarkets = async (sport = '1') => {
  // Check if backend is responding
  const isBackendAvailable = await checkBackendHealth();
  
  if (!isBackendAvailable && USE_MOCK_DATA) {
    console.log('Backend unavailable, using mock data immediately');
    return MOCK_MARKETS;
  }
  
  // Try to fetch from backend with retry logic
  let attemptCount = 0;
  
  const attemptFetch = async () => {
    attemptCount++;
    const url = '/api/betfair/live-markets';
    if (attemptCount === 1 || errorLogCount < MAX_LOG_ERRORS) {
      console.log(`Fetching markets for sport ${sport} from ${url} (Attempt ${attemptCount}/${RETRY_COUNT + 1})`);
    }
    
    try {
      const response = await axios.get(url, {
        params: { stake: 100.0, sport }
      });
      
      // Reset error counter on success
      errorLogCount = 0;
      
      // If successful but empty or invalid, fall back to mock data
      if (!Array.isArray(response.data) || response.data.length === 0) {
        console.warn('Expected array or non-empty data, got:', response.data);
        return USE_MOCK_DATA ? MOCK_MARKETS : [];
      }
      
      const marketCount = response.data.length;
      console.log(`Successfully received ${marketCount} markets from backend`);
      
      // Process the markets data
      return response.data.map(market => ({
        id: market.id,
        name: market.name || 'Match Odds',
        event_name: market.event_name,
        competition: market.competition,
        startTime: market.startTime,
        odds: market.odds || [],
        max_profit: market.max_profit || 0
      }));
    } catch (error) {
      // Limit error logging to reduce console spam
      if (errorLogCount < MAX_LOG_ERRORS) {
        console.error('Error fetching markets:', 
          error.message, 
          error.response?.status, 
          error.response?.data
        );
        
        // Specific error handling
        if (error.code === 'ECONNABORTED') {
          console.warn(`Connection timed out after ${DEFAULT_TIMEOUT}ms`);
        } else if (!error.response) {
          console.warn('No response from backend');
        }
        
        errorLogCount++;
      }
      
      // If we have retries left, try again
      if (attemptCount <= RETRY_COUNT) {
        console.log(`Retrying... (${attemptCount}/${RETRY_COUNT})`);
        return attemptFetch();
      }
      
      // All retries exhausted, use mock data if enabled
      console.log('All retries failed, using mock data');
      return USE_MOCK_DATA ? MOCK_MARKETS : [];
    }
  };
  
  return attemptFetch();
};

// Fetch odds for a specific market
export const fetchMarketOdds = async (marketId) => {
  try {
    const url = `/api/betfair/market-odds/${marketId}`;
    console.log(`Fetching odds for market ${marketId} from ${url}`);
    const response = await axios.get(url);
    
    // Reset error counter on success
    errorLogCount = 0;
    
    return response.data;
  } catch (error) {
    if (errorLogCount < MAX_LOG_ERRORS) {
      console.error(`Error fetching odds for ${marketId}:`, error.message);
      errorLogCount++;
    }
    
    // Find the market in mock data
    if (USE_MOCK_DATA) {
      const mockMarket = MOCK_MARKETS.find(m => m.id === marketId);
      if (mockMarket) {
        return {
          market_id: marketId,
          runners: mockMarket.odds.map(o => ({
            selection_id: o.selection_id,
            runner_name: o.runner_name,
            best_back_price: o.best_back_price,
            best_lay_price: o.best_lay_price,
            status: 'ACTIVE'
          }))
        };
      }
    }
    
    return { market_id: marketId, runners: [] };
  }
};

// Calculate hedge opportunities
export const calculateHedgeOpportunities = async (marketId, runners) => {
  try {
    const url = '/api/hedge-opportunities';
    console.log(`Calculating hedge opportunities for market ${marketId}`);
    
    const response = await axios.post(url, {
      market_id: marketId,
      runners: runners
    });
    
    // Reset error counter on success
    errorLogCount = 0;
    
    return response.data;
  } catch (error) {
    if (errorLogCount < MAX_LOG_ERRORS) {
      console.error('Error calculating hedge opportunities:', error.message);
      errorLogCount++;
    }
    
    // Simple fallback calculation
    return {
      market_id: marketId,
      hedge_opportunities: []
    };
  }
};