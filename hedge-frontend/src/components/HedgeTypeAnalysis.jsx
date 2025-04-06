import React, { useState, useEffect, useMemo, useId } from 'react';
import { Card, CardHeader, CardTitle, CardBody, Button, Form, Spinner, Badge, Alert, Tabs, Tab, Table } from 'react-bootstrap';
import { FiFilter, FiRefreshCw, FiDollarSign, FiTrendingUp, FiZap, FiAlertTriangle, FiCheck, FiTool } from 'react-icons/fi';

// API base URL based on environment
const API_BASE = process.env.NODE_ENV === 'production' ? '/api' : '/api';

const HedgeTypeAnalysis = () => {
  // Generate unique IDs for form elements
  const id = useId();
  
  // State for opportunities and UI
  const [opportunities, setOpportunities] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  
  // State for tracking individual executions
  const [executions, setExecutions] = useState({});
  const [executingIds, setExecutingIds] = useState(new Set());
  
  // State for filters
  const [filters, setFilters] = useState({
    stake: 100,
    minProfit: 0.5,
    includeExchangeInternal: true,
    includeCrossExchange: true,
    includeBookmakerExchange: true,
    includeBookmakerBookmaker: false,
    includeMultiLeg: false,
    maxResults: 20,
  });
  
  // Format currency with locale support
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
    }).format(value);
  };

  // Validate form inputs
  const isFormValid = useMemo(() => {
    return (
      filters.stake > 0 && 
      filters.minProfit >= 0 && 
      filters.maxResults > 0 &&
      (
        filters.includeExchangeInternal || 
        filters.includeCrossExchange || 
        filters.includeBookmakerExchange || 
        filters.includeBookmakerBookmaker || 
        filters.includeMultiLeg
      )
    );
  }, [filters]);

  // Filter opportunities based on active tab
  const filteredOpportunities = useMemo(() => {
    return opportunities.filter((op) => {
      if (activeTab === 'all') return true;
      return op.hedge_type === activeTab;
    });
  }, [opportunities, activeTab]);
  
  // Count opportunities by type
  const opportunityCounts = useMemo(() => {
    return {
      all: opportunities.length,
      exchange_internal: opportunities.filter(op => op.hedge_type === 'exchange_internal').length,
      cross_exchange: opportunities.filter(op => op.hedge_type === 'cross_exchange').length,
      bookmaker_exchange: opportunities.filter(op => op.hedge_type === 'bookmaker_exchange').length,
      bookmaker_bookmaker: opportunities.filter(op => op.hedge_type === 'bookmaker_bookmaker').length,
      multi_leg: opportunities.filter(op => op.hedge_type === 'multi_leg').length,
    };
  }, [opportunities]);

  // Handle filter changes
  const handleFilterChange = (field, value) => {
    setFilters(prevFilters => ({
      ...prevFilters,
      [field]: value,
    }));
  };

  // Fetch hedge opportunities
  const fetchOpportunities = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      const response = await fetch(`${API_BASE}/hedge/find-opportunities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stake: filters.stake,
          min_profit_percentage: filters.minProfit,
          include_exchange_internal: filters.includeExchangeInternal,
          include_cross_exchange: filters.includeCrossExchange,
          include_bookmaker_exchange: filters.includeBookmakerExchange,
          include_bookmaker_bookmaker: filters.includeBookmakerBookmaker,
          include_multi_leg: filters.includeMultiLeg,
          max_results: filters.maxResults,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ 
          detail: `HTTP error ${response.status}` 
        }));
        throw new Error(errorData.detail || `Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setOpportunities(data.opportunities || []);
      
      // Reset to all tab if current tab has no opportunities
      if (activeTab !== 'all' && !data.opportunities.some(op => op.hedge_type === activeTab)) {
        setActiveTab('all');
      }
    } catch (error) {
      console.error('Error fetching opportunities:', error);
      setErrorMessage(error.message || 'Failed to fetch opportunities');
      setOpportunities([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Execute a hedge opportunity
  const executeHedge = async (opportunityId) => {
    // Mark as executing
    setExecutingIds(prev => new Set([...prev, opportunityId]));
    
    try {
      // Step 1: Validate opportunity
      const validationResponse = await fetch(`${API_BASE}/hedge/validate-opportunity?opportunity_id=${opportunityId}`, {
        method: 'POST',
      });
      
      if (!validationResponse.ok) {
        const errorData = await validationResponse.json().catch(() => ({ 
          detail: `Validation failed: HTTP error ${validationResponse.status}` 
        }));
        throw new Error(errorData.detail || 'Validation failed');
      }
      
      const validationData = await validationResponse.json();
      
      // Alert user if opportunity is no longer profitable
      if (!validationData.valid) {
        const proceed = window.confirm(
          `This opportunity may no longer be profitable: ${validationData.details?.message || 'Market conditions have changed'}. Do you still want to proceed?`
        );
        if (!proceed) {
          return;
        }
      }
      
      // Step 2: Execute hedge
      const executionResponse = await fetch(`${API_BASE}/hedge/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          opportunity_id: opportunityId,
          validated: true,
        }),
      });
      
      if (!executionResponse.ok) {
        const errorData = await executionResponse.json().catch(() => ({ 
          detail: `Execution failed: HTTP error ${executionResponse.status}` 
        }));
        throw new Error(errorData.detail || 'Execution failed');
      }
      
      const executionData = await executionResponse.json();
      
      // Update execution tracking state
      setExecutions(prev => ({
        ...prev,
        [opportunityId]: {
          execution_id: executionData.execution_id,
          status: executionData.status,
          timestamp: new Date().toISOString(),
        },
      }));
      
      // Start polling for status updates
      pollExecutionStatus(executionData.execution_id, opportunityId);
      
    } catch (error) {
      console.error('Error executing hedge:', error);
      alert(`Failed to execute hedge: ${error.message}`);
    } finally {
      // Remove from executing set
      setExecutingIds(prev => {
        const newSet = new Set([...prev]);
        newSet.delete(opportunityId);
        return newSet;
      });
    }
  };

  // Poll execution status
  const pollExecutionStatus = async (executionId, opportunityId) => {
    try {
      const response = await fetch(`${API_BASE}/hedge/execution-status/${executionId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to get execution status: HTTP error ${response.status}`);
      }
      
      const data = await response.json();
      
      // Update execution state
      setExecutions(prev => ({
        ...prev,
        [opportunityId]: {
          ...prev[opportunityId],
          status: data.status,
          details: data.details,
          last_updated: new Date().toISOString(),
        },
      }));
      
      // Continue polling if not complete
      if (data.status === 'in_progress' || data.status === 'pending') {
        setTimeout(() => pollExecutionStatus(executionId, opportunityId), 2000);
      }
    } catch (error) {
      console.error('Error polling execution status:', error);
      
      // Update execution state with error
      setExecutions(prev => ({
        ...prev,
        [opportunityId]: {
          ...prev[opportunityId],
          status: 'error',
          error_message: error.message,
          last_updated: new Date().toISOString(),
        },
      }));
    }
  };

  // Get badge color for hedge type
  const getHedgeTypeBadgeColor = (hedgeType) => {
    const badgeColors = {
      exchange_internal: 'primary',
      cross_exchange: 'success',
      bookmaker_exchange: 'warning',
      bookmaker_bookmaker: 'danger',
      multi_leg: 'info',
    };
    return badgeColors[hedgeType] || 'secondary';
  };

  // Get human-readable hedge type name
  const getHedgeTypeName = (hedgeType) => {
    const hedgeTypeNames = {
      exchange_internal: 'Exchange Internal',
      cross_exchange: 'Cross-Exchange',
      bookmaker_exchange: 'Bookmaker-Exchange',
      bookmaker_bookmaker: 'Bookmaker-Bookmaker',
      multi_leg: 'Multi-Leg',
    };
    return hedgeTypeNames[hedgeType] || hedgeType;
  };

  // Get execution status badge
  const getExecutionStatusBadge = (status) => {
    const statusBadges = {
      completed: <Badge bg="success">Completed</Badge>,
      in_progress: <Badge bg="warning">In Progress</Badge>,
      pending: <Badge bg="info">Pending</Badge>,
      failed: <Badge bg="danger">Failed</Badge>,
      partially_completed: <Badge bg="warning">Partial</Badge>,
      error: <Badge bg="danger">Error</Badge>,
    };
    return statusBadges[status] || <Badge bg="secondary">Unknown</Badge>;
  };

  return (
    <div className="container-fluid">
      <h1 className="mb-4">Advanced Hedge Analysis</h1>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="d-flex align-items-center">
            <FiFilter className="me-2" />
            Hedge Type Analysis Settings
          </CardTitle>
        </CardHeader>

        <CardBody>
          <Form>
            <div className="row">
              <div className="col-md-4 mb-3">
                <Form.Group controlId={`${id}-stake`}>
                  <Form.Label>Stake (£)</Form.Label>
                  <Form.Control
                    type="number"
                    name="stake"
                    value={filters.stake}
                    onChange={(e) => handleFilterChange('stake', parseFloat(e.target.value) || 0)}
                    min="1"
                    isInvalid={filters.stake <= 0}
                  />
                  {filters.stake <= 0 && (
                    <Form.Control.Feedback type="invalid">
                      Stake must be greater than 0
                    </Form.Control.Feedback>
                  )}
                </Form.Group>
              </div>

              <div className="col-md-4 mb-3">
                <Form.Group controlId={`${id}-min-profit`}>
                  <Form.Label>Min Profit Percentage (%)</Form.Label>
                  <Form.Control
                    type="number"
                    name="minProfit"
                    value={filters.minProfit}
                    onChange={(e) => handleFilterChange('minProfit', parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.1"
                    isInvalid={filters.minProfit < 0}
                  />
                  {filters.minProfit < 0 && (
                    <Form.Control.Feedback type="invalid">
                      Minimum profit must be at least 0
                    </Form.Control.Feedback>
                  )}
                </Form.Group>
              </div>

              <div className="col-md-4 mb-3">
                <Form.Group controlId={`${id}-max-results`}>
                  <Form.Label>Max Results</Form.Label>
                  <Form.Control
                    type="number"
                    name="maxResults"
                    value={filters.maxResults}
                    onChange={(e) => handleFilterChange('maxResults', parseInt(e.target.value) || 0)}
                    min="1"
                    max="100"
                    isInvalid={filters.maxResults <= 0 || filters.maxResults > 100}
                  />
                  {(filters.maxResults <= 0 || filters.maxResults > 100) && (
                    <Form.Control.Feedback type="invalid">
                      Max results must be between 1 and 100
                    </Form.Control.Feedback>
                  )}
                </Form.Group>
              </div>
            </div>

            <fieldset className="mb-3">
              <legend className="col-form-label">Hedge Types to Include:</legend>
              <div className="row">
                <div className="col-md-4 mb-2">
                  <Form.Check
                    type="switch"
                    id={`${id}-exchange-internal`}
                    name="includeExchangeInternal"
                    label="Exchange Internal"
                    checked={filters.includeExchangeInternal}
                    onChange={(e) => handleFilterChange('includeExchangeInternal', e.target.checked)}
                  />
                </div>

                <div className="col-md-4 mb-2">
                  <Form.Check
                    type="switch"
                    id={`${id}-cross-exchange`}
                    name="includeCrossExchange"
                    label="Cross-Exchange"
                    checked={filters.includeCrossExchange}
                    onChange={(e) => handleFilterChange('includeCrossExchange', e.target.checked)}
                  />
                </div>

                <div className="col-md-4 mb-2">
                  <Form.Check
                    type="switch"
                    id={`${id}-bookmaker-exchange`}
                    name="includeBookmakerExchange"
                    label="Bookmaker-Exchange"
                    checked={filters.includeBookmakerExchange}
                    onChange={(e) => handleFilterChange('includeBookmakerExchange', e.target.checked)}
                  />
                </div>

                <div className="col-md-4 mb-2">
                  <Form.Check
                    type="switch"
                    id={`${id}-bookmaker-bookmaker`}
                    name="includeBookmakerBookmaker"
                    label="Bookmaker-Bookmaker"
                    checked={filters.includeBookmakerBookmaker}
                    onChange={(e) => handleFilterChange('includeBookmakerBookmaker', e.target.checked)}
                  />
                </div>

                <div className="col-md-4 mb-2">
                  <Form.Check
                    type="switch"
                    id={`${id}-multi-leg`}
                    name="includeMultiLeg"
                    label="Multi-Leg Hedges"
                    checked={filters.includeMultiLeg}
                    onChange={(e) => handleFilterChange('includeMultiLeg', e.target.checked)}
                  />
                </div>
              </div>
              
              {!(
                filters.includeExchangeInternal ||
                filters.includeCrossExchange ||
                filters.includeBookmakerExchange ||
                filters.includeBookmakerBookmaker ||
                filters.includeMultiLeg
              ) && (
                <div className="text-danger small mt-2">
                  Please select at least one hedge type
                </div>
              )}
            </fieldset>

            <Button
              variant="primary"
              onClick={fetchOpportunities}
              disabled={!isFormValid || isLoading}
              className="d-flex align-items-center"
              id={`${id}-find-button`}
            >
              {isLoading ? (
                <>
                  <Spinner size="sm" className="me-2" />
                  Analyzing...
                </>
              ) : (
                <>
                  <FiRefreshCw size={16} className="me-2" />
                  Find Hedge Opportunities
                </>
              )}
            </Button>
          </Form>
        </CardBody>
      </Card>

      {errorMessage && (
        <Alert variant="danger" className="mb-4">
          <div className="d-flex align-items-center">
            <FiAlertTriangle className="me-2" size={20} />
            <div>
              <h5 className="alert-heading mb-1">Error</h5>
              <p className="mb-0">{errorMessage}</p>
            </div>
          </div>
        </Alert>
      )}

      {opportunities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="d-flex align-items-center">
              <FiTrendingUp className="me-2" />
              Hedge Opportunities
              <Badge bg="secondary" className="ms-2">
                {opportunities.length}
              </Badge>
            </CardTitle>
          </CardHeader>

          <CardBody>
            <Tabs
              activeKey={activeTab}
              onSelect={(key) => setActiveTab(key)}
              className="mb-4"
              id={`${id}-tabs`}
            >
              <Tab eventKey="all" title="All Types">
                <Badge bg="secondary" className="me-2">
                  {opportunityCounts.all}
                </Badge>
              </Tab>

              <Tab eventKey="exchange_internal" title="Exchange Internal">
                <Badge bg="primary" className="me-2">
                  {opportunityCounts.exchange_internal}
                </Badge>
              </Tab>

              <Tab eventKey="cross_exchange" title="Cross-Exchange">
                <Badge bg="success" className="me-2">
                  {opportunityCounts.cross_exchange}
                </Badge>
              </Tab>

              <Tab eventKey="bookmaker_exchange" title="Bookmaker-Exchange">
                <Badge bg="warning" className="me-2">
                  {opportunityCounts.bookmaker_exchange}
                </Badge>
              </Tab>

              <Tab eventKey="bookmaker_bookmaker" title="Bookmaker-Bookmaker">
                <Badge bg="danger" className="me-2">
                  {opportunityCounts.bookmaker_bookmaker}
                </Badge>
              </Tab>

              <Tab eventKey="multi_leg" title="Multi-Leg">
                <Badge bg="info" className="me-2">
                  {opportunityCounts.multi_leg}
                </Badge>
              </Tab>
            </Tabs>

            <div className="table-responsive">
              <Table striped hover>
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Selection</th>
                    <th>Type</th>
                    <th>Back</th>
                    <th>Lay</th>
                    <th>Profit</th>
                    <th>Actions</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOpportunities.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-4 text-muted">
                        No opportunities found for this hedge type.
                      </td>
                    </tr>
                  ) : (
                    filteredOpportunities.map((op) => (
                      <tr key={op.id}>
                        <td>{op.event_name}</td>
                        <td>{op.runner_name}</td>
                        <td>
                          <Badge bg={getHedgeTypeBadgeColor(op.hedge_type)} className="text-white">
                            {getHedgeTypeName(op.hedge_type)}
                          </Badge>
                        </td>
                        <td>
                          {op.back_exchange} @ {op.back_odds.toFixed(2)}
                        </td>
                        <td>
                          {op.lay_exchange} @ {op.lay_odds.toFixed(2)}
                        </td>
                        <td className="text-success fw-bold">
                          {formatCurrency(op.profit)} ({op.profit_percentage.toFixed(2)}%)
                        </td>
                        <td>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => executeHedge(op.id)}
                            disabled={
                              executingIds.has(op.id) || 
                              (executions[op.id] && ['in_progress', 'pending'].includes(executions[op.id].status))
                            }
                            id={`${id}-execute-${op.id}`}
                          >
                            {executingIds.has(op.id) ? (
                              <Spinner size="sm" className="me-1" />
                            ) : executions[op.id] && ['in_progress', 'pending'].includes(executions[op.id].status) ? (
                              <Spinner size="sm" className="me-1" />
                            ) : (
                              <FiZap size={14} className="me-1" />
                            )}
                            Execute
                          </Button>
                        </td>
                        <td>
                          {executions[op.id] ? (
                            getExecutionStatusBadge(executions[op.id].status)
                          ) : (
                            <Badge bg="secondary">Not Started</Badge>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </div>
          </CardBody>
        </Card>
      )}

      {!isLoading && opportunities.length === 0 && (
        <div className="text-center p-5 bg-light rounded">
          <FiTool size={48} className="text-muted mb-3" />
          <h4>No Hedge Opportunities Found</h4>
          <p className="text-muted">
            Adjust your filters or click "Find Hedge Opportunities" to search for profitable betting hedges
          </p>
        </div>
      )}
    </div>
  );
};

export default HedgeTypeAnalysis;