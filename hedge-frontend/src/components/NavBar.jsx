import React from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';

const NavBar = ({ activeTab, setActiveTab }) => {
  return (
    <nav className="navbar navbar-expand-md navbar-dark bg-primary shadow-sm">
      <div className="container-fluid">
        <a className="navbar-brand text-center" href="/">
          <span className="fw-bold fs-3">The Hedge Betting App</span>
          <p className="small text-white opacity-75 mb-0">Smart betting, made simple</p>
        </a>
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
          aria-controls="navbarNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse justify-content-center" id="navbarNav">
          <ul className="navbar-nav gap-2">
            <li className="nav-item">
              <button
                className={`nav-link btn ${activeTab === 'calculator' ? 'btn-light text-primary' : 'btn-link text-white'}`}
                onClick={() => setActiveTab('calculator')}
              >
                Calculator
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link btn ${activeTab === 'betfair' ? 'btn-light text-primary' : 'btn-link text-white'}`}
                onClick={() => setActiveTab('betfair')}
              >
                Betfair Markets
              </button>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default NavBar;