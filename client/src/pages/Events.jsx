import { useEffect, useState } from 'react';
import { getEvents } from '../api.js';

function Events() {
  const [events, setEvents] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const limit = 20;

  const loadPage = async (p) => {
    setLoading(true);
    try {
      const res = await getEvents(p, limit);
      setEvents(res.data);
      setPage(res.page);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPage(1);
  }, []);

  // SSE for new events
  useEffect(() => {
    const es = new EventSource(`${import.meta.env.VITE_API_URL}/stream`);
    const handler = (e) => {
      if (e.type !== 'event') return;
      const payload = JSON.parse(e.data);
      setEvents((prev) => [payload, ...prev].slice(0, limit));
    };
    es.addEventListener('event', handler);
    return () => {
      es.removeEventListener('event', handler);
      es.close();
    };
  }, []);

  if (loading) return <div className="loading">Loading events…</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <section className="events">
      <h1>Events</h1>
      <table className="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Device</th>
            <th>Type</th>
            <th>Timestamp</th>
            <th>Payload</th>
          </tr>
        </thead>
        <tbody>
          {events.map((ev) => (
            <tr key={ev.eventId}>
              <td>{ev.eventId}</td>
              <td>{ev.deviceId}</td>
              <td>{ev.type}</td>
              <td>{new Date(ev.timestamp).toLocaleString()}</td>
              <td>{JSON.stringify(ev.payload)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pagination">
        <button onClick={() => loadPage(page - 1)} disabled={page <= 1}>Prev</button>
        <span>Page {page}</span>
        <button onClick={() => loadPage(page + 1)}>Next</button>
      </div>
    </section>
  );
}

export default Events;
