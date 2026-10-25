// src/pages/Incidents.jsx
import { useEffect, useState } from 'react';
import { getIncidents, patchIncident } from '../api.js';

function Incidents() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initial load
  useEffect(() => {
    async function load() {
      try {
        const res = await getIncidents(1, 20);
        setIncidents(res.data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // SSE updates for incidents
  useEffect(() => {
    const es = new EventSource(`${import.meta.env.VITE_API_URL}/stream`);
    const handler = (e) => {
      if (e.type !== 'incident') return;
      const payload = JSON.parse(e.data);
      setIncidents((prev) => {
        const idx = prev.findIndex((i) => i._id === payload._id);
        if (idx === -1) return [payload, ...prev];
        const copy = [...prev];
        copy[idx] = payload;
        return copy;
      });
    };
    es.addEventListener('incident', handler);
    return () => {
      es.removeEventListener('incident', handler);
      es.close();
    };
  }, []);

  const handleAction = async (id, updates) => {
    try {
      const updated = await patchIncident(id, updates);
      setIncidents((prev) => prev.map((i) => (i._id === id ? updated : i)));
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading) return <div className="loading">Loading incidents…</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <section className="incidents">
      <h1>Incidents</h1>
      <table className="data-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Severity</th>
            <th>Status</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {incidents.map((inc) => (
            <tr key={inc._id}>
              <td>{inc.title}</td>
              <td>{inc.severity}</td>
              <td>{inc.status}</td>
              <td>{new Date(inc.createdAt).toLocaleString()}</td>
              <td>
                {inc.status !== 'resolved' && (
                  <button onClick={() => handleAction(inc._id, { status: 'resolved' })}>Resolve</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default Incidents;
