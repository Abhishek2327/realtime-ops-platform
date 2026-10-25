import { useEffect, useState } from 'react';
import { getDevices } from '../api.js';

function Devices() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initial load
  useEffect(() => {
    async function load() {
      try {
        const data = await getDevices();
        setDevices(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // SSE updates for device changes
  useEffect(() => {
    const es = new EventSource(`${import.meta.env.VITE_API_URL}/stream`);
    const handler = (e) => {
      const payload = JSON.parse(e.data);
      if (e.type === 'device') {
        setDevices((prev) => {
          const idx = prev.findIndex((d) => d.deviceId === payload.deviceId);
          if (idx === -1) return [...prev, payload];
          const copy = [...prev];
          copy[idx] = payload;
          return copy;
        });
      }
    };
    es.addEventListener('device', handler);
    return () => {
      es.removeEventListener('device', handler);
      es.close();
    };
  }, []);

  if (loading) return <div className="loading">Loading devices…</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <section className="devices">
      <h1>Devices</h1>
      <table className="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Location</th>
            <th>Status</th>
            <th>Last Seen</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((d) => (
            <tr key={d.deviceId}>
              <td>{d.deviceId}</td>
              <td>{d.name}</td>
              <td>{d.location}</td>
              <td>{d.status}</td>
              <td>{new Date(d.lastSeenAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default Devices;
