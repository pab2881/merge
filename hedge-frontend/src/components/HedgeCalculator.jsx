import React, { useState, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';

const HedgeCalculator = ({ initialOdds }) => {
  const [formData, setFormData] = useState({
    backOdds: initialOdds?.backOdds || '',
    layOdds: initialOdds?.layOdds || '',
    stake: '100',
    commission: '5',
  });
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const { backOdds, layOdds, stake, commission } = formData;
    if (backOdds && layOdds && stake && commission) {
      const b = parseFloat(backOdds);
      const l = parseFloat(layOdds);
      const s = parseFloat(stake);
      const c = parseFloat(commission) / 100;

      if (b <= 1 || l <= 1 || s <= 0 || c < 0 || c > 1) {
        setError('Odds must be > 1, stake > 0, commission 0-100%');
        setResults(null);
        return;
      }

      const layStake = (b * s) / (l - c * (l - 1));
      const backProfit = s * (b - 1);
      const layLiability = layStake * (l - 1);
      const profitIfBackWins = backProfit - layLiability;
      const profitIfLayWins = layStake * (1 - c) - s;
      const isArbitrage = profitIfBackWins > 0 && profitIfLayWins > 0;

      setResults({
        layStake: layStake.toFixed(2),
        layLiability: layLiability.toFixed(2),
        profitIfBackWins: profitIfBackWins.toFixed(2),
        profitIfLayWins: profitIfLayWins.toFixed(2),
        isArbitrage,
      });
      setError(null);
    } else {
      setResults(null);
      setError(null);
    }
  }, [formData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
      setFormData({ ...formData, [name]: value });
    }
  };

  return (
    <div className="card shadow-sm p-4 mx-auto" style={{ maxWidth: '500px' }}>
      <h2 className="card-title h5 mb-4 text-dark">Hedge Calculator</h2>
      <form className="row g-3">
        <div className="col-12">
          <label htmlFor="backOdds" className="form-label">Back Odds</label>
          <input
            type="text"
            id="backOdds"
            name="backOdds"
            value={formData.backOdds}
            onChange={handleInputChange}
            placeholder="e.g. 2.0"
            className="form-control"
            required
          />
        </div>
        <div className="col-12">
          <label htmlFor="layOdds" className="form-label">Lay Odds</label>
          <input
            type="text"
            id="layOdds"
            name="layOdds"
            value={formData.layOdds}
            onChange={handleInputChange}
            placeholder="e.g. 1.9"
            className="form-control"
            required
          />
        </div>
        <div className="col-12">
          <label htmlFor="stake" className="form-label">Back Stake (£)</label>
          <div className="input-group">
            <input
              type="text"
              id="stake"
              name="stake"
              value={formData.stake}
              onChange={handleInputChange}
              placeholder="e.g. 100"
              className="form-control"
              required
            />
            <span className="input-group-text">£</span>
          </div>
        </div>
        <div className="col-12">
          <label htmlFor="commission" className="form-label">Commission (%)</label>
          <div className="input-group">
            <input
              type="text"
              id="commission"
              name="commission"
              value={formData.commission}
              onChange={handleInputChange}
              placeholder="e.g. 5"
              className="form-control"
              required
            />
            <span className="input-group-text">%</span>
          </div>
        </div>
      </form>

      {error && (
        <div className="alert alert-danger mt-3" role="alert">
          {error}
        </div>
      )}

      {results && (
        <div className="mt-4 p-3 bg-light rounded">
          <h3 className="h6 mb-2">Results</h3>
          <table className="table table-sm">
            <tbody>
              <tr>
                <td>Lay Stake:</td>
                <td className="fw-medium">£{results.layStake}</td>
              </tr>
              <tr>
                <td>Lay Liability:</td>
                <td className="fw-medium">£{results.layLiability}</td>
              </tr>
              <tr>
                <td>Profit (Back Wins):</td>
                <td className={`fw-medium ${results.profitIfBackWins >= 0 ? 'text-success' : 'text-danger'}`}>
                  £{results.profitIfBackWins}
                </td>
              </tr>
              <tr>
                <td>Profit (Lay Wins):</td>
                <td className={`fw-medium ${results.profitIfLayWins >= 0 ? 'text-success' : 'text-danger'}`}>
                  £{results.profitIfLayWins}
                </td>
              </tr>
              <tr>
                <td>Arbitrage:</td>
                <td className={results.isArbitrage ? 'text-success fw-medium' : 'text-muted'}>
                  {results.isArbitrage ? 'Yes' : 'No'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 text-muted small">
        <h4 className="fw-medium">How to Use:</h4>
        <ul className="list-disc ps-4">
          <li>Enter bookmaker back odds.</li>
          <li>Enter exchange lay odds.</li>
          <li>Set your stake and commission.</li>
          <li>See your hedge results instantly.</li>
        </ul>
      </div>
    </div>
  );
};

export default HedgeCalculator;