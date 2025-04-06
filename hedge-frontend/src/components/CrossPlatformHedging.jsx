import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardBody, Button, Spinner, Badge, Alert, Form } from 'react-bootstrap';
import { ArrowRight, TrendingUp, BookOpen, RefreshCw, Filter } from 'lucide-react';

const CrossPlatformHedging = () => {
  // State for opportunities
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stake, setStake] = useState(100);
  const [minProfit, setMinProfit] = useState(0.5);
  const [includeBookmakers, setIncludeBookmakers] = useState(true);
  const [filterPlatform, setFilterPlatform] = useState('all');
  
  // Fetch opportunities
  const fetchOpportunities = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `http://localhost:3003/api/cross-platform/opportunities?stake=${stake}&min_profit_percentage=${minProfit}&include_bookmakers=${includeBookmakers}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch opportunities');
      }
      
      const data = await response.json();
      setOpportunities(data);
    } catch (err) {
      console.error('Error fetching opportunities:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2
    }).format(value);
  };
  
  // Filter opportunities by platform
  const filteredOpportunities = opportunities.filter(op => {
    if (filterPlatform === 'all') return true;
    if (filterPlatform === 'exchanges') {
      return op.back_platform !== 'oddsapi' && op.lay_platform !== 'oddsapi';
    }
    if (filterPlatform === 'bookmakers') {
      return op.back_platform === 'oddsapi' || op.lay_platform === 'oddsapi';
    }
    return (op.back_platform === filterPlatform || op.lay_platform === filterPlatform);
  });
  
  // Platform badge color
  const getPlatformColor = (platform) => {
    switch (platform) {
      case 'betfair':
        return 'primary';
      case 'smarkets':
        return 'success';
      case 'oddsapi':
        return 'warning';
      default:
        return 'secondary';
    }
  };
  
  // Platform display name
  const getPlatformDisplayName = (platform, exchange) => {
    if (platform === 'oddsapi') {
      return exchange; // Use the bookmaker name for The Odds API
    }
    return platform.charAt(0).toUpperCase() + platform.slice(1);
  };

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <h1 className="text-3xl font-bold mb-2">Cross-Platform Hedge Opportunities</h1>
      <p className="text-gray-500 mb-6">Find profitable hedge betting opportunities across Betfair, Smarkets, and traditional bookmakers</p>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="mr-2" size={20} />
            Search Settings
          </CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Form.Label htmlFor="hedge-stake">Stake (£)</Form.Label>
              <Form.Control
                id="hedge-stake"
                name="hedge-stake"
                type="number"
                value={stake}
                onChange={(e) => setStake(Math.max(1, parseFloat(e.target.value)))}
                min="1"
                step="10"
              />
            </div>
            
            <div>
              <Form.Label htmlFor="hedge-min-profit">Min Profit (%)</Form.Label>
              <Form.Control
                id="hedge-min-profit"
                name="hedge-min-profit"
                type="number"
                value={minProfit}
                onChange={(e) => setMinProfit(Math.max(0, parseFloat(e.target.value)))}
                min="0"
                step="0.1"
              />
            </div>
            
            <div>
              <Form.Label htmlFor="hedge-filter-platform">Filter Platform</Form.Label>
              <Form.Select
                id="hedge-filter-platform"
                name="hedge-filter-platform"
                value={filterPlatform}
                onChange={(e) => setFilterPlatform(e.target.value)}
              >
                <option value="all">All Platforms</option>
                <option value="exchanges">Exchanges Only</option>
                <option value="bookmakers">Bookmakers Included</option>
                <option value="betfair">Betfair</option>
                <option value="smarkets">Smarkets</option>
                <option value="oddsapi">Traditional Bookmakers</option>
              </Form.Select>
            </div>
            
            <div className="flex items-end">
              <Form.Check
                type="switch"
                id="hedge-include-bookmakers"
                name="hedge-include-bookmakers"
                label="Include Bookmakers"
                checked={includeBookmakers}
                onChange={(e) => setIncludeBookmakers(e.target.checked)}
                className="mb-2"
              />
            </div>
          </div>
          
          <div className="mt-4">
            <Button
              onClick={fetchOpportunities}
              disabled={loading}
              className="flex items-center"
            >
              {loading ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Searching...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2" size={16} />
                  Find Opportunities
                </>
              )}
            </Button>
          </div>
        </CardBody>
      </Card>
      
      {error && (
        <Alert variant="danger" className="mb-4">
          <Alert.Heading>Error</Alert.Heading>
          <p>{error}</p>
        </Alert>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="mr-2" size={20} />
            Hedge Opportunities
            {filteredOpportunities.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {filteredOpportunities.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardBody>
          {loading ? (
            <div className="text-center py-8">
              <Spinner />
              <p className="mt-2">Searching for opportunities...</p>
            </div>
          ) : filteredOpportunities.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 text-left">Event</th>
                    <th className="p-2 text-left">Selection</th>
                    <th className="p-2 text-left">Back</th>
                    <th className="p-2 text-left">Lay</th>
                    <th className="p-2 text-right">Stake</th>
                    <th className="p-2 text-right">Lay Stake</th>
                    <th className="p-2 text-right">Profit</th>
                    <th className="p-2 text-right">%</th>
                    <th className="p-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOpportunities.map((op, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-medium">{op.event_name}</td>
                      <td className="p-2">{op.runner_name}</td>
                      <td className="p-2">
                        <div className="flex items-center">
                          <Badge 
                            bg={getPlatformColor(op.back_platform)}
                            className="mr-1"
                          >
                            {getPlatformDisplayName(op.back_platform, op.back_exchange)}
                          </Badge>
                          {op.back_odds.toFixed(2)}
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="flex items-center">
                          <Badge 
                            bg={getPlatformColor(op.lay_platform)}
                            className="mr-1"
                          >
                            {getPlatformDisplayName(op.lay_platform, op.lay_exchange)}
                          </Badge>
                          {op.lay_odds.toFixed(2)}
                        </div>
                      </td>
                      <td className="p-2 text-right">{formatCurrency(op.stake)}</td>
                      <td className="p-2 text-right">{formatCurrency(op.lay_stake)}</td>
                      <td className="p-2 text-right font-medium text-green-600">
                        {formatCurrency(op.profit)}
                      </td>
                      <td className="p-2 text-right font-medium text-green-600">
                        {op.profit_percentage.toFixed(2)}%
                      </td>
                      <td className="p-2 text-center">
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          className="flex items-center mx-auto"
                          data-bs-toggle="modal"
                          data-bs-target={`#instructionModal-${index}`}
                        >
                          <BookOpen size={16} />
                        </Button>
                        
                        {/* Modal for displaying detailed instructions */}
                        <div 
                          className="modal fade" 
                          id={`instructionModal-${index}`} 
                          tabIndex="-1" 
                          aria-labelledby={`instructionModalLabel-${index}`} 
                          aria-hidden="true"
                        >
                          <div className="modal-dialog">
                            <div className="modal-content">
                              <div className="modal-header">
                                <h5 className="modal-title" id={`instructionModalLabel-${index}`}>
                                  Hedge Instructions
                                </h5>
                                <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                              </div>
                              <div className="modal-body">
                                <div className="mb-4">
                                  <h6 className="font-bold">Event</h6>
                                  <p>{op.event_name}</p>
                                  <h6 className="font-bold mt-3">Selection</h6>
                                  <p>{op.runner_name}</p>
                                </div>
                                
                                <div className="border-t pt-3">
                                  <h6 className="font-bold">Instructions</h6>
                                  <pre className="bg-gray-100 p-3 rounded whitespace-pre-wrap">
                                    {op.instructions}
                                  </pre>
                                </div>
                                
                                <div className="mt-4 border-t pt-3">
                                  <h6 className="font-bold">Market IDs</h6>
                                  <div className="grid grid-cols-2 gap-2 mt-2">
                                    <div>
                                      <Badge bg={getPlatformColor(op.back_platform)}>
                                        {getPlatformDisplayName(op.back_platform, op.back_exchange)}
                                      </Badge>
                                      <div className="text-xs mt-1 break-all">{op.back_market_id}</div>
                                    </div>
                                    <div>
                                      <Badge bg={getPlatformColor(op.lay_platform)}>
                                        {getPlatformDisplayName(op.lay_platform, op.lay_exchange)}
                                      </Badge>
                                      <div className="text-xs mt-1 break-all">{op.lay_market_id}</div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              {opportunities.length > 0 && filteredOpportunities.length === 0 ? (
                <p>No opportunities match your current filter settings.</p>
              ) : (
                <p>No hedge opportunities found. Click "Find Opportunities" to check for arbitrage chances.</p>
              )}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

export default CrossPlatformHedging;