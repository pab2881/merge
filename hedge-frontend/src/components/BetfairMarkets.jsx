import React, { useState, useEffect, useCallback } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { fetchBetfairMarkets, checkBackendHealth } from '../services/betfairService';

const DEFAULT_COMMISSION = 0.05;
const REFRESH_INTERVAL = 60000; // 1 minute

const BetfairMarkets = ({ onSelectOdds }) => {
  const [markets, setMarkets] = useState([]);
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [marketOdds, setMarketOdds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [logMessages, setLogMessages] = useState([]);
  const [backendStatus, setBackendStatus] = useState('unknown');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const addLogMessage = (message) => {
    setLogMessages(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`].slice(-10));
  };

  const calculateHedgeBet = (backOdds, layOdds, stake = 100, commission = DEFAULT_COMMISSION) => {
    if (!backOdds || !layOdds || backOdds <= 0 || layOdds <= 0 || layOdds <= 1) return null;
    const backWinnings = stake * (backOdds - 1);
    const layStake = (stake * backOdds) / (layOdds - commission * (layOdds - 1));
    const layLiability = layStake * (layOdds - 1);
    const profitIfBackWins = backWinnings - layLiability;
    const profitIfLayWins = layStake * (1 - commission) - stake;
    return {
      layStake: layStake.toFixed(2),
      profitIfBackWins: profitIfBackWins.toFixed(2),
      profitIfLayWins: profitIfLayWins.toFixed(2),
      estimatedProfit: Math.min(profitIfBackWins, profitIfLayWins).toFixed(2),
    };
  };

  const fetchAndAnalyzeMarkets = useCallback(async () => {
    setLoading(true);
    addLogMessage('Checking backend status...');
    
    try {
      const isHealthy = await checkBackendHealth();
      setBackendStatus(isHealthy ? 'online' : 'offline');
      addLogMessage(isHealthy ? 'Backend is online, fetching live markets...' : 'Backend is offline, using fallback data');
      
      const allMarkets = await fetchBetfairMarkets('1');
      console.log('Processed markets:', allMarkets);
      addLogMessage(`Received ${allMarkets.length} markets ${isHealthy ? 'from backend' : 'from fallback data'}`);
      
      setMarkets(allMarkets);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      setError(`Failed to load markets: ${err.message}`);
      addLogMessage(`Error: ${err.message}`);
      setSelectedMarket(null);
      setMarketOdds([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAndAnalyzeMarkets();
  }, [fetchAndAnalyzeMarkets]);

  useEffect(() => {
    if (!autoRefresh) return;
    const intervalId = setInterval(() => {
      addLogMessage('Auto-refreshing markets...');
      fetchAndAnalyzeMarkets();
    }, REFRESH_INTERVAL);
    return () => clearInterval(intervalId);
  }, [autoRefresh, fetchAndAnalyzeMarkets]);

  const handleSelectMarket = (marketId) => {
    setSelectedMarket(marketId);
    const market = markets.find(m => m.id === marketId);
    if (market && market.odds) {
      const enrichedRunners = market.odds.map(runner => ({
        ...runner,
        hedgeData: calculateHedgeBet(runner.best_back_price, runner.best_lay_price),
      }));
      setMarketOdds(enrichedRunners);
      addLogMessage(`Loaded odds for ${market.event_name}`);
    } else {
      setMarketOdds([]);
      addLogMessage(`No odds available for market ${marketId}`);
    }
  };

  const handleRefresh = () => {
    addLogMessage('Manual refresh triggered');
    fetchAndAnalyzeMarkets();
  };

  const filteredMarkets = markets.filter(market =>
    !searchTerm ||
    (market.name && market.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (market.event_name && market.event_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (market.competition && market.competition.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="card bg-dark text-light shadow-lg mb-4">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="card-title h4 mb-0">Betfair Markets</h2>
          <div>
            {backendStatus === 'online' ? (
              <span className="badge bg-success me-2">Backend Online</span>
            ) : backendStatus === 'offline' ? (
              <span className="badge bg-danger me-2">Backend Offline</span>
            ) : (
              <span className="badge bg-secondary me-2">Checking...</span>
            )}
            {lastUpdated && (
              <small className="text-muted">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </small>
            )}
          </div>
        </div>

        {loading && (
          <div className="d-flex justify-content-center align-items-center py-3">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <span className="ms-2">Loading...</span>
          </div>
        )}

        {error && (
          <div className="alert alert-danger mb-3" role="alert">
            {error}
          </div>
        )}

        <div className="row g-3">
          <div className="col-md-4">
            <input
              type="text"
              placeholder="Search markets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-control bg-secondary text-light border-secondary mb-3"
            />
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h3 className="h5 mb-0">Markets ({filteredMarkets.length})</h3>
              <div>
                <div className="form-check form-switch d-inline-block me-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="autoRefreshSwitch"
                    checked={autoRefresh}
                    onChange={() => setAutoRefresh(!autoRefresh)}
                  />
                  <label className="form-check-label" htmlFor="autoRefreshSwitch">
                    Auto
                  </label>
                </div>
                <button 
                  className="btn btn-primary" 
                  onClick={handleRefresh}
                  disabled={loading}
                >
                  {loading ? (
                    <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                  ) : (
                    <i className="bi bi-arrow-clockwise me-1"></i>
                  )}
                  Refresh
                </button>
              </div>
            </div>
            <div className="overflow-auto" style={{ maxHeight: '50vh' }}>
              {filteredMarkets.length === 0 ? (
                <p className="text-warning">No markets loaded.</p>
              ) : (
                filteredMarkets.map(market => (
                  <div
                    key={market.id}
                    onClick={() => handleSelectMarket(market.id)}
                    className={`card mb-2 ${selectedMarket === market.id ? 'bg-primary' : 'bg-secondary'} text-light border-secondary cursor-pointer`}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="card-body p-3">
                      <div className="fw-bold">{market.name || 'Match Odds'}</div>
                      <div>{market.event_name || 'Unknown Event'}</div>
                      <div className="d-flex justify-content-between mt-2 small">
                        <span>{market.startTime ? new Date(market.startTime).toLocaleString() : 'N/A'}</span>
                        {market.competition && (
                          <span className="badge bg-info text-dark">{market.competition}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="col-md-8">
            <div className="row g-3">
              <div className="col-12">
                <div className="card bg-secondary text-light border-secondary p-3">
                  {!selectedMarket ? (
                    <div className="text-center py-3 text-info">Select a market to view odds</div>
                  ) : (
                    <>
                      <h3 className="h5 mb-3">
                        {markets.find(m => m.id === selectedMarket)?.event_name || 'Selected Market'}
                      </h3>
                      {marketOdds.length === 0 ? (
                        <p className="text-warning">No odds available for this market.</p>
                      ) : (
                        <div className="d-flex flex-column gap-3">
                          {marketOdds.map(runner => (
                            <div key={runner.selection_id} className="card bg-dark border-dark">
                              <div className="card-body">
                                <div className="d-flex justify-content-between mb-2">
                                  <h4 className="h6">{runner.runner_name}</h4>
                                  <span className="badge bg-success">{runner.status || 'ACTIVE'}</span>
                                </div>
                                <div className="row g-3">
                                  <div className="col-6">
                                    <div className="bg-primary p-2 rounded text-center">
                                      <div className="small text-light">Back</div>
                                      <div className="fs-4 fw-bold">{runner.best_back_price ? runner.best_back_price.toFixed(2) : '-'}</div>
                                    </div>
                                  </div>
                                  <div className="col-6">
                                    <div className="bg-danger p-2 rounded text-center">
                                      <div className="small text-light">Lay</div>
                                      <div className="fs-4 fw-bold">{runner.best_lay_price ? runner.best_lay_price.toFixed(2) : '-'}</div>
                                    </div>
                                  </div>
                                </div>
                                {runner.hedgeData && (
                                  <div className="mt-2 small">
                                    <p>Lay Stake: £{runner.hedgeData.layStake}</p>
                                    <p>Profit (Back Wins): <span className={parseFloat(runner.hedgeData.profitIfBackWins) >= 0 ? 'text-success' : 'text-danger'}>£{runner.hedgeData.profitIfBackWins}</span></p>
                                    <p>Profit (Lay Wins): <span className={parseFloat(runner.hedgeData.profitIfLayWins) >= 0 ? 'text-success' : 'text-danger'}>£{runner.hedgeData.profitIfLayWins}</span></p>
                                    <p>Estimated Profit: <span className={parseFloat(runner.hedgeData.estimatedProfit) >= 0 ? 'text-success' : 'text-danger'}>£{runner.hedgeData.estimatedProfit}</span></p>
                                    <button
                                      onClick={() => onSelectOdds({ backOdds: runner.best_back_price, layOdds: runner.best_lay_price })}
                                      className="btn btn-primary btn-sm mt-2"
                                    >
                                      Use in Calculator
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="col-12">
                <div className="card bg-secondary text-light border-secondary p-3">
                  <h3 className="h5 mb-3">Live Log</h3>
                  <div className="overflow-auto" style={{ maxHeight: '20vh' }}>
                    {logMessages.length === 0 ? (
                      <p className="text-muted">No log messages yet.</p>
                    ) : (
                      <ul className="list-unstyled mb-0">
                        {logMessages.map((msg, index) => (
                          <li key={index} className="small">{msg}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BetfairMarkets;