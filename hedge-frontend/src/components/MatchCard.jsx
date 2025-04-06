import React from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';

const MatchCard = ({ match, onBetSelect, isHedgeOpportunity = false }) => {
  const odds1 = typeof match.odds1 === "number" ? match.odds1 : parseFloat(match.odds1) || 0;
  const odds2 = typeof match.odds2 === "number" ? match.odds2 : parseFloat(match.odds2) || 0;

  const totalStake = 100;
  const impliedProb1 = odds1 > 0 ? 1 / odds1 : 0;
  const impliedProb2 = odds2 > 0 ? 1 / odds2 : 0;
  const totalImpliedProb = impliedProb1 + impliedProb2;
  const stake1 = totalImpliedProb < 1 ? (totalStake * impliedProb1 / totalImpliedProb).toFixed(2) : 0;
  const stake2 = totalImpliedProb < 1 ? (totalStake * impliedProb2 / totalImpliedProb).toFixed(2) : 0;
  const win1 = stake1 * odds1;
  const win2 = stake2 * odds2;
  const estimatedProfit = totalImpliedProb < 1 ? (Math.min(win1, win2) - (parseFloat(stake1) + parseFloat(stake2))).toFixed(2) : 0;
  const profitPercentage = totalImpliedProb < 1 ? ((100 - (totalImpliedProb * 100))).toFixed(2) : 0;

  const getRiskLevel = () => {
    if (profitPercentage > 3) return { level: 'Low', color: 'bg-success text-white' };
    if (profitPercentage > 1) return { level: 'Medium', color: 'bg-warning text-dark' };
    return { level: 'High', color: 'bg-danger text-white' };
  };
  const riskLevel = getRiskLevel();

  if (isHedgeOpportunity) {
    return (
      <div className="card border-dark shadow-sm mb-3">
        <div className="card-header bg-dark text-white d-flex justify-content-between align-items-center">
          <h3 className="h5 mb-0">{match.matchup || `${match.team1} vs ${match.team2}`}</h3>
          <span className={`badge ${riskLevel.color}`}>{riskLevel.level} Risk</span>
        </div>
        <div className="card-body">
          <p className="mb-2"><span className="text-muted">Market: </span>{match.marketType || 'Match Odds'}</p>
          <div className="row g-3 mb-3">
            <div className="col-6">
              <div className="bg-light p-2 rounded">
                <div className="small text-muted">{match.bookieA || match.platform1 || 'Betfair'}</div>
                <div>{match.selectionA || match.team1}</div>
                <div className="text-warning fw-bold fs-5">{odds1.toFixed(2)}</div>
                <div className="small text-muted">Stake: £{stake1}</div>
              </div>
            </div>
            <div className="col-6">
              <div className="bg-light p-2 rounded">
                <div className="small text-muted">{match.bookieB || match.platform2 || 'Exchange'}</div>
                <div>{match.selectionB || match.team2}</div>
                <div className="text-warning fw-bold fs-5">{odds2.toFixed(2)}</div>
                <div className="small text-muted">Stake: £{stake2}</div>
              </div>
            </div>
          </div>
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <span className="text-muted">Expected Profit: </span>
              <span className="text-success fw-bold">{match.expectedProfit || profitPercentage}%</span>
            </div>
            <button
              onClick={() => onBetSelect && onBetSelect(match)}
              className="btn btn-success btn-sm"
            >
              Hedge Now
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card border-primary mb-2">
      <div className="card-body d-flex justify-content-between align-items-center">
        <div>
          <p className="mb-0 fw-semibold">{match.team1} vs {match.team2}</p>
          <p className="small text-muted mb-0">{match.league || match.competition || 'Betfair Exchange'}</p>
        </div>
        <div className="d-flex gap-2">
          <span className="badge bg-dark text-warning">{odds1.toFixed(2)}</span>
          <span className="badge bg-dark text-warning">{odds2.toFixed(2)}</span>
        </div>
        <div className="text-end">
          {match.isLive && <span className="badge bg-danger mb-1">LIVE</span>}
          {profitPercentage > 0 && (
            <p className="text-success fw-bold mb-0">£{estimatedProfit}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatchCard;