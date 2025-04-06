import React, { useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import BetfairMarkets from './components/BetfairMarkets';
import CrossPlatformHedging from './components/CrossPlatformHedging';
import HedgeTypeAnalysis from './components/HedgeTypeAnalysis';
import ThreeWayHedgeAnalysis from './components/ThreeWayHedgeAnalysis';
import { Container, Row, Col, Nav, Tab, Card } from 'react-bootstrap';

function App() {
  const [calculatorOdds, setCalculatorOdds] = useState({
    backOdds: 0,
    layOdds: 0,
    stake: 100,
    backExchange: 'Betfair',
    layExchange: 'Betfair'
  });
  
  const [activeTab, setActiveTab] = useState('three-way');

  // Handler for selecting odds from market components
  const handleSelectOdds = (odds) => {
    setCalculatorOdds(odds);
    // Scroll to calculator
    document.getElementById('calculator-section').scrollIntoView({ behavior: 'smooth' });
  };

  // Calculate hedge bet
  const calculateHedgeBet = (backOdds, layOdds, stake, backCommission = 0.05, layCommission = 0.05) => {
    if (!backOdds || !layOdds || backOdds <= 0 || layOdds <= 0 || layOdds <= 1) return null;

    // Calculate potential winnings from back bet (after commission)
    const backWinnings = stake * (backOdds - 1) * (1 - backCommission);
    
    // Calculate lay stake required to hedge
    const layStake = (stake * backOdds) / layOdds;
    
    // Calculate lay liability
    const layLiability = layStake * (layOdds - 1);
    
    // Calculate profit scenarios
    const profitIfBackWins = backWinnings - layLiability;
    const profitIfLayWins = layStake * (1 - layCommission) - stake;
    
    // The guaranteed profit is the minimum of the two scenarios
    const profit = Math.min(profitIfBackWins, profitIfLayWins);
    const profitPercentage = (profit / stake) * 100;
    
    return {
      layStake: layStake.toFixed(2),
      profitIfBackWins: profitIfBackWins.toFixed(2),
      profitIfLayWins: profitIfLayWins.toFixed(2),
      estimatedProfit: profit.toFixed(2),
      profitPercentage: profitPercentage.toFixed(2)
    };
  };

  // Get commission rate based on exchange
  const getCommissionRate = (exchange) => {
    if (exchange === 'Smarkets') return 0.02; // 2%
    return 0.05; // 5% default for Betfair
  };

  // Calculate for the calculator
  const hedgeData = calculatorOdds.backOdds && calculatorOdds.layOdds
    ? calculateHedgeBet(
        calculatorOdds.backOdds, 
        calculatorOdds.layOdds, 
        calculatorOdds.stake,
        getCommissionRate(calculatorOdds.backExchange),
        getCommissionRate(calculatorOdds.layExchange)
      )
    : null;

  return (
    <Container fluid className="bg-dark text-light min-vh-100 py-4">
      <header className="mb-4 text-center">
        <h1 className="display-5">Multi-Platform Hedge Betting System</h1>
        <p className="lead">Find profitable betting opportunities across Betfair, Smarkets, and traditional bookmakers</p>
      </header>

      <Tab.Container activeKey={activeTab} onSelect={setActiveTab}>
        <Row className="mb-4">
          <Col>
            <Nav variant="tabs" className="bg-secondary rounded-top">
              <Nav.Item>
                <Nav.Link 
                  eventKey="three-way" 
                  className={activeTab === 'three-way' ? 'bg-primary text-white' : 'text-light'}
                >
                  <i className="bi bi-trophy me-1"></i>
                  Three-Way Hedge
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link 
                  eventKey="hedge-analysis" 
                  className={activeTab === 'hedge-analysis' ? 'bg-primary text-white' : 'text-light'}
                >
                  <i className="bi bi-lightning me-1"></i>
                  Hedge Analysis
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link 
                  eventKey="cross-platform" 
                  className={activeTab === 'cross-platform' ? 'bg-primary text-white' : 'text-light'}
                >
                  <i className="bi bi-arrow-left-right me-1"></i>
                  Cross-Platform
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link 
                  eventKey="betfair" 
                  className={activeTab === 'betfair' ? 'bg-primary text-white' : 'text-light'}
                >
                  <i className="bi bi-graph-up me-1"></i>
                  Betfair Markets
                </Nav.Link>
              </Nav.Item>
            </Nav>
          </Col>
        </Row>

        <Row>
          <Col>
            <Tab.Content>
              <Tab.Pane eventKey="three-way">
                <ThreeWayHedgeAnalysis />
              </Tab.Pane>
              <Tab.Pane eventKey="hedge-analysis">
                <HedgeTypeAnalysis />
              </Tab.Pane>
              <Tab.Pane eventKey="cross-platform">
                <CrossPlatformHedging onSelectOdds={handleSelectOdds} />
              </Tab.Pane>
              <Tab.Pane eventKey="betfair">
                <BetfairMarkets onSelectOdds={handleSelectOdds} />
              </Tab.Pane>
            </Tab.Content>
          </Col>
        </Row>
      </Tab.Container>

      <Row id="calculator-section" className="mt-4">
        <Col>
          <Card bg="dark" text="light" className="shadow-lg border-secondary">
            <Card.Header className="bg-primary text-white">
              <h2 className="h4 mb-0">Hedge Calculator</h2>
            </Card.Header>
            <Card.Body>
              <Row>
                <Col md={3} className="mb-3">
                  <div className="form-group">
                    <label htmlFor="backExchange">Back Exchange</label>
                    <select
                      id="backExchange"
                      className="form-control bg-secondary text-light"
                      value={calculatorOdds.backExchange}
                      onChange={(e) => setCalculatorOdds({...calculatorOdds, backExchange: e.target.value})}
                    >
                      <option value="Betfair">Betfair (5% commission)</option>
                      <option value="Smarkets">Smarkets (2% commission)</option>
                      <option value="Bookmaker">Bookmaker (0% commission)</option>
                    </select>
                  </div>
                </Col>
                <Col md={3} className="mb-3">
                  <div className="form-group">
                    <label htmlFor="backOdds">Back Odds</label>
                    <input
                      id="backOdds"
                      type="number"
                      step="0.01"
                      min="1.01"
                      className="form-control bg-secondary text-light"
                      value={calculatorOdds.backOdds}
                      onChange={(e) => setCalculatorOdds({...calculatorOdds, backOdds: parseFloat(e.target.value)})}
                    />
                  </div>
                </Col>
                <Col md={3} className="mb-3">
                  <div className="form-group">
                    <label htmlFor="layExchange">Lay Exchange</label>
                    <select
                      id="layExchange"
                      className="form-control bg-secondary text-light"
                      value={calculatorOdds.layExchange}
                      onChange={(e) => setCalculatorOdds({...calculatorOdds, layExchange: e.target.value})}
                    >
                      <option value="Betfair">Betfair (5% commission)</option>
                      <option value="Smarkets">Smarkets (2% commission)</option>
                    </select>
                  </div>
                </Col>
                <Col md={3} className="mb-3">
                  <div className="form-group">
                    <label htmlFor="layOdds">Lay Odds</label>
                    <input
                      id="layOdds"
                      type="number"
                      step="0.01"
                      min="1.01"
                      className="form-control bg-secondary text-light"
                      value={calculatorOdds.layOdds}
                      onChange={(e) => setCalculatorOdds({...calculatorOdds, layOdds: parseFloat(e.target.value)})}
                    />
                  </div>
                </Col>
              </Row>

              <Row>
                <Col md={4} className="mb-3">
                  <div className="form-group">
                    <label htmlFor="stake">Back Stake (£)</label>
                    <input
                      id="stake"
                      type="number"
                      step="1"
                      min="1"
                      className="form-control bg-secondary text-light"
                      value={calculatorOdds.stake}
                      onChange={(e) => setCalculatorOdds({...calculatorOdds, stake: parseFloat(e.target.value)})}
                    />
                  </div>
                </Col>
                <Col md={8}>
                  {hedgeData ? (
                    <div className="alert bg-success text-white">
                      <div className="d-flex justify-content-between mb-2">
                        <strong>Required Lay Stake:</strong>
                        <span>£{hedgeData.layStake}</span>
                      </div>
                      <div className="d-flex justify-content-between mb-2">
                        <strong>Profit if Back Wins:</strong>
                        <span className={parseFloat(hedgeData.profitIfBackWins) >= 0 ? 'text-white' : 'text-danger'}>
                          £{hedgeData.profitIfBackWins}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between mb-2">
                        <strong>Profit if Lay Wins:</strong>
                        <span className={parseFloat(hedgeData.profitIfLayWins) >= 0 ? 'text-white' : 'text-danger'}>
                          £{hedgeData.profitIfLayWins}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between mb-2">
                        <strong>Guaranteed Profit:</strong>
                        <span className={parseFloat(hedgeData.estimatedProfit) >= 0 ? 'text-white' : 'text-danger'}>
                          £{hedgeData.estimatedProfit} ({hedgeData.profitPercentage}%)
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="alert bg-secondary">
                      Enter valid odds to calculate your hedge bet
                    </div>
                  )}
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <footer className="mt-5 text-center text-muted">
        <p className="small">
          <i className="bi bi-info-circle me-1"></i>
          Commission rates: Betfair 5%, Smarkets 2%, Bookmakers 0% (built into odds)
        </p>
        <p className="small">
          © {new Date().getFullYear()} Multi-Platform Hedge Betting System
        </p>
      </footer>
    </Container>
  );
}

export default App;