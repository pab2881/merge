import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './darkTheme.css'; // Import the dark theme CSS

// API service functions
const BETFAIR_API_BASE = 'http://localhost:3001/api';

const BetfairMarkets = () => {
  const [markets, setMarkets] = useState([]);
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [marketOdds, setMarketOdds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Fetch markets
  useEffect(() => {
    const fetchMarkets = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${BETFAIR_API_BASE}/betfair/live-markets`);
        setMarkets(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        setError('Failed to load markets');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchMarkets();
  }, []);
  
  // Fetch odds when market is selected
  useEffect(() => {
    if (!selectedMarket) return;
    
    const fetchOdds = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${BETFAIR_API_BASE}/betfair/market-odds/${selectedMarket}`);
        setMarketOdds(response.data?.runners || []);
      } catch (err) {
        setError('Failed to load odds');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchOdds();
  }, [selectedMarket]);
  
  const refreshMarkets = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${BETFAIR_API_BASE}/betfair/live-markets`);
      setMarkets(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError('Failed to refresh markets');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  const filteredMarkets = markets.filter(market => 
    !searchTerm || 
    market.market_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    market.event_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const handleSelectMarket = (marketId) => {
    setSelectedMarket(marketId);
  };
  
  return (
    <div className="betfair-container">
      <h2>Betfair Markets</h2>
      
      {loading && (
        <div style={{display: 'flex', justifyContent: 'center', padding: '1rem'}}>
          <div className="loading-spinner"></div>
          <span style={{marginLeft: '0.5rem', color: 'white'}}>Loading...</span>
        </div>
      )}
      
      {error && (
        <div style={{backgroundColor: '#7F1D1D', color: 'white', padding: '0.75rem', borderRadius: '0.375rem', marginBottom: '1rem'}}>
          {error}
        </div>
      )}
      
      <div style={{display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem'}}>
        {/* Markets list */}
        <div className="betfair-markets-list">
          <div style={{marginBottom: '1rem'}}>
            <input 
              type="text" 
              className="search-input"
              placeholder="Search markets..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
            <h3 style={{color: 'white', margin: 0}}>Markets ({filteredMarkets.length})</h3>
            <button className="refresh-button" onClick={refreshMarkets}>
              Refresh
            </button>
          </div>
          
          <div style={{maxHeight: '70vh', overflowY: 'auto'}}>
            {filteredMarkets.map(market => (
              <div 
                key={market.market_id}
                className={`market-item ${selectedMarket === market.market_id ? 'selected' : ''}`}
                onClick={() => handleSelectMarket(market.market_id)}
              >
                <div className="market-item-title">{market.market_name}</div>
                <div className="market-item-subtitle">{market.event_name}</div>
                <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem'}}>
                  <span className="market-item-date">{new Date(market.start_time).toLocaleString()}</span>
                  {market.competition && (
                    <span className="market-item-competition">{market.competition}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Odds display */}
        <div className="odds-card">
          {!selectedMarket ? (
            <div style={{textAlign: 'center', padding: '2rem'}}>
              <p style={{color: '#93C5FD'}}>Select a market to view odds</p>
            </div>
          ) : (
            <>
              <h3 style={{color: 'white', marginBottom: '1rem'}}>Market Odds</h3>
              
              {marketOdds.length === 0 ? (
                <p style={{color: '#FCD34D'}}>No odds available for this market.</p>
              ) : (
                <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                  {marketOdds.map(runner => {
                    const hasBackOdds = runner.best_back_price > 0;
                    const hasLayOdds = runner.best_lay_price > 0;
                    const isArbitrageOpportunity = hasBackOdds && hasLayOdds && runner.best_back_price > runner.best_lay_price;
                    
                    return (
                      <div 
                        key={runner.selection_id}
                        className={`runner-card ${isArbitrageOpportunity ? 'arbitrage' : ''}`}
                      >
                        <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '1rem'}}>
                          <h4 style={{color: 'white', margin: 0}}>{runner.runner_name}</h4>
                          <span style={{backgroundColor: '#064E3B', color: '#10B981', padding: '0.25rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem'}}>
                            {runner.status}
                          </span>
                        </div>
                        
                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                          <div className="back-odds">
                            <div className="odds-label">Back Price</div>
                            <div className="odds-value">
                              {hasBackOdds ? runner.best_back_price.toFixed(2) : '-'}
                            </div>
                          </div>
                          <div className="lay-odds">
                            <div className="odds-label">Lay Price</div>
                            <div className="odds-value">
                              {hasLayOdds ? runner.best_lay_price.toFixed(2) : '-'}
                            </div>
                          </div>
                        </div>
                        
                        {isArbitrageOpportunity && (
                          <div className="arbitrage-alert">
                            <div className="arbitrage-alert-title">Arbitrage Opportunity!</div>
                            <div className="arbitrage-alert-text">
                              Back at {runner.best_back_price.toFixed(2)} and lay at {runner.best_lay_price.toFixed(2)} for guaranteed profit.
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BetfairMarkets;