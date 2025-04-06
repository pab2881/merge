import React, { useState, useEffect } from 'react';
import { fetchBetfairMarkets, fetchMarketOdds, findHedgeOpportunities } from '../services/api';

const BetfairMarkets = () => {
  // State for markets and odds
  const [markets, setMarkets] = useState([]);
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [selectedMarketDetails, setSelectedMarketDetails] = useState(null);
  const [marketOdds, setMarketOdds] = useState([]);
  const [hedgeOpportunities, setHedgeOpportunities] = useState([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('markets'); // 'markets', 'odds', 'hedges'
  const [selectedSport, setSelectedSport] = useState('1'); // Default to soccer

  // Available sports
  const sports = [
    { id: '1', name: 'Soccer' },
    { id: '2', name: 'Tennis' },
    { id: '7', name: 'Horse Racing' },
    { id: '4339', name: 'Cricket' }
  ];

  // Fetch markets when component mounts or sport changes
  useEffect(() => {
    const loadMarkets = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const data = await fetchBetfairMarkets(selectedSport);
        console.log('Markets data:', data);
        
        setMarkets(data || []);
        
        // Reset selections when sport changes
        setSelectedMarket(null);
        setSelectedMarketDetails(null);
        setMarketOdds([]);
        setHedgeOpportunities([]);
        setActiveTab('markets');
      } catch (err) {
        console.error('Error loading markets:', err);
        setError('Failed to load markets. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadMarkets();
  }, [selectedSport]);

  // Fetch odds when a market is selected
  useEffect(() => {
    if (!selectedMarket) return;
    
    const loadOdds = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const data = await fetchMarketOdds(selectedMarket);
        console.log('Odds data:', data);
        
        setMarketOdds(data.runners || []);
        
        // Find potential hedge opportunities
        if (data.runners && data.runners.length > 0) {
          const opportunities = await findHedgeOpportunities(selectedMarket, data.runners);
          setHedgeOpportunities(opportunities.hedge_opportunities || []);
          
          // If hedge opportunities exist, switch to that tab
          if (opportunities.hedge_opportunities && opportunities.hedge_opportunities.length > 0) {
            setActiveTab('hedges');
          } else {
            setActiveTab('odds');
          }
        }
      } catch (err) {
        console.error('Error loading odds:', err);
        setError('Failed to load odds. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadOdds();
  }, [selectedMarket]);

  // Handle market selection
  const handleSelectMarket = (market) => {
    setSelectedMarket(market.id);
    setSelectedMarketDetails(market);
  };

  // Handle sport change
  const handleSportChange = (e) => {
    setSelectedSport(e.target.value);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h2 className="text-2xl font-bold mb-4">Betfair Markets</h2>
      
      {/* Sport selector */}
      <div className="mb-4">
        <label htmlFor="sport-select" className="block text-sm font-medium text-gray-700 mb-1">
          Select Sport:
        </label>
        <select
          id="sport-select"
          value={selectedSport}
          onChange={handleSportChange}
          className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          disabled={loading}
        >
          {sports.map((sport) => (
            <option key={sport.id} value={sport.id}>
              {sport.name}
            </option>
          ))}
        </select>
      </div>
      
      {/* Loading indicator */}
      {loading && (
        <div className="flex justify-center items-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-blue-500">Loading...</span>
        </div>
      )}
      
      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
        </div>
      )}
      
      {/* Main content area */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Markets list - takes up 2/5 of the space on large screens */}
        <div className={`lg:col-span-2 ${selectedMarket ? 'lg:block' : 'block'}`}>
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold mb-2">Available Markets</h3>
            
            {/* No markets message */}
            {!loading && markets.length === 0 && (
              <p className="text-gray-500 p-3">No markets available for the selected sport.</p>
            )}
            
            {/* Markets list */}
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {markets.map((market) => (
                <div
                  key={market.id}
                  className={`p-3 rounded-md cursor-pointer transition-colors ${
                    selectedMarket === market.id
                      ? 'bg-blue-100 border border-blue-300'
                      : 'bg-white border border-gray-200 hover:bg-gray-100'
                  }`}
                  onClick={() => handleSelectMarket(market)}
                >
                  <p className="font-medium">{market.name}</p>
                  <p className="text-sm text-gray-600">{market.team1} v {market.team2}</p>
                  <p className="text-xs text-gray-500">Competition: {market.competition}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(market.startTime).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Odds and hedge opportunities - takes up 3/5 of the space on large screens */}
        <div className="lg:col-span-3">
          {!selectedMarket ? (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-blue-700">Select a market to view odds and find hedge opportunities.</p>
            </div>
          ) : (
            <div>
              {/* Market details */}
              <div className="bg-white p-4 rounded-lg border border-gray-200 mb-4">
                <h3 className="text-xl font-semibold">
                  {selectedMarketDetails?.name}
                </h3>
                <p className="text-gray-600">
                  {selectedMarketDetails?.team1} v {selectedMarketDetails?.team2}
                </p>
                <p className="text-sm text-gray-500">
                  Competition: {selectedMarketDetails?.competition}
                </p>
              </div>
              
              {/* Tabs */}
              <div className="flex border-b border-gray-200 mb-4">
                <button
                  className={`px-4 py-2 font-medium ${
                    activeTab === 'odds'
                      ? 'border-b-2 border-blue-500 text-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => setActiveTab('odds')}
                >
                  Odds
                </button>
                <button
                  className={`px-4 py-2 font-medium ${
                    activeTab === 'hedges'
                      ? 'border-b-2 border-blue-500 text-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => setActiveTab('hedges')}
                >
                  Hedge Opportunities
                  {hedgeOpportunities.length > 0 && (
                    <span className="ml-1 bg-green-100 text-green-800 text-xs font-semibold px-2 py-0.5 rounded-full">
                      {hedgeOpportunities.length}
                    </span>
                  )}
                </button>
              </div>
              
              {/* Odds tab content */}
              {activeTab === 'odds' && (
                <div>
                  {marketOdds.length === 0 ? (
                    <p className="text-gray-500">No odds available for this market.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {marketOdds.map((runner) => (
                        <div
                          key={runner.selection_id}
                          className={`p-3 rounded-lg border ${
                            runner.best_back_price > runner.best_lay_price
                              ? 'bg-green-50 border-green-200'
                              : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <p className="font-semibold text-lg">{runner.runner_name}</p>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div className="bg-blue-50 p-2 rounded">
                              <p className="text-xs text-blue-700">Back Price</p>
                              <p className="text-xl font-bold text-blue-800">{runner.best_back_price || '-'}</p>
                            </div>
                            <div className="bg-pink-50 p-2 rounded">
                              <p className="text-xs text-pink-700">Lay Price</p>
                              <p className="text-xl font-bold text-pink-800">{runner.best_lay_price || '-'}</p>
                            </div>
                          </div>
                          {runner.best_back_price > runner.best_lay_price && (
                            <div className="mt-2 bg-green-100 p-2 rounded text-center">
                              <p className="text-green-800 text-sm font-semibold">
                                Potential hedge opportunity!
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {/* Hedge opportunities tab content */}
              {activeTab === 'hedges' && (
                <div>
                  {hedgeOpportunities.length === 0 ? (
                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                      <p className="text-yellow-700">
                        No hedge opportunities found for this market. Hedge opportunities occur when the back price is higher than the lay price.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {hedgeOpportunities.map((hedge, index) => (
                        <div
                          key={index}
                          className="bg-green-50 p-4 rounded-lg border border-green-200"
                        >
                          <h4 className="text-lg font-semibold text-green-800">{hedge.runner_name}</h4>
                          
                          <div className="grid grid-cols-2 gap-4 mt-3">
                            <div className="bg-blue-50 p-3 rounded">
                              <p className="text-sm font-medium text-blue-700">Back Bet</p>
                              <p className="text-lg">
                                <span className="font-bold">£{hedge.back_stake.toFixed(2)}</span> @ {hedge.back_odds}
                              </p>
                            </div>
                            
                            <div className="bg-pink-50 p-3 rounded">
                              <p className="text-sm font-medium text-pink-700">Lay Bet</p>
                              <p className="text-lg">
                                <span className="font-bold">£{hedge.lay_stake.toFixed(2)}</span> @ {hedge.lay_odds}
                              </p>
                            </div>
                          </div>
                          
                          <div className="mt-4 bg-white p-3 rounded-lg border border-green-300">
                            <div className="flex justify-between items-center">
                              <p className="text-sm font-medium text-gray-600">Guaranteed Profit:</p>
                              <p className="text-xl font-bold text-green-600">£{hedge.profit.toFixed(2)}</p>
                            </div>
                            <div className="flex justify-between items-center mt-1">
                              <p className="text-sm font-medium text-gray-600">ROI:</p>
                              <p className="text-lg font-semibold text-green-600">{hedge.profit_percentage.toFixed(2)}%</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BetfairMarkets;