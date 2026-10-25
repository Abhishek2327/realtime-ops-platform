import { useEffect, useState } from 'react';
import { getDevices, getEvents, getIncidents } from '../api.js';

function Overview() {
  const [devices, setDevices] = useState([]);
  const [events, setEvents] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [devRes, evRes, incRes] = await Promise.all([
          getDevices(),
          getEvents(1, 5),
          getIncidents(1, 5),
        ]);
        setDevices(devRes);
        setEvents(evRes.data);
        setIncidents(incRes.data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="loading">Loading overview…</div>;
  if (error) return <div className="error">Error: {error}</div>;

  const online = devices.filter(d => d.status === 'online').length;
  const offline = devices.length - online;

  return (
    <div className="overview">
      <h1>Operations Overview</h1>
      <section className="summary">
        <div>Total Devices: {devices.length}</div>
        <div>Online: {online}</div>
        <div>Offline: {offline}</div>
        <div>Active Incidents: {incidents.filter(i => i.status !== 'resolved').length}</div>
      </section>
      <section className="recent">
        <h2>Recent Events</h2>
        <ul>
          {events.map(ev => (
            <li key={ev.eventId}>
              [{new Date(ev.timestamp).toLocaleTimeString()}] {ev.type} from {ev.deviceId}
            </li>
          ))}
        </ul>
        <h2>Recent Incidents</h2>
        <ul>
          {incidents.map(inc => (
            <li key={inc._id}>
              [{new Date(inc.createdAt).toLocaleTimeString()}] {inc.title} ({inc.severity})
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default Overview;
