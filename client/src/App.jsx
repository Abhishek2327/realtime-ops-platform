import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import Overview from './pages/Overview.jsx';
import Devices from './pages/Devices.jsx';
import Events from './pages/Events.jsx';
import Rules from './pages/Rules.jsx';
import Incidents from './pages/Incidents.jsx';
import './dashboard.css';

function App() {
  return (
    <Router>
      <div className="app-container">
        <nav className="sidebar">
          <h2>Ops Console</h2>
          <ul>
            <li><NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>Overview</NavLink></li>
            <li><NavLink to="/devices" className={({ isActive }) => isActive ? 'active' : ''}>Devices</NavLink></li>
            <li><NavLink to="/events" className={({ isActive }) => isActive ? 'active' : ''}>Events</NavLink></li>
            <li><NavLink to="/rules" className={({ isActive }) => isActive ? 'active' : ''}>Rules</NavLink></li>
            <li><NavLink to="/incidents" className={({ isActive }) => isActive ? 'active' : ''}>Incidents</NavLink></li>
          </ul>
        </nav>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/devices" element={<Devices />} />
            <Route path="/events" element={<Events />} />
            <Route path="/rules" element={<Rules />} />
            <Route path="/incidents" element={<Incidents />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
