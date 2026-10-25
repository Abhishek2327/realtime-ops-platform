import { useEffect, useState } from 'react';
import { getRules, postRule } from '../api.js';

function Rules() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ name: '', enabled: true, conditionType: 'temperature_threshold', deviceId: '' });
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await getRules();
        setRules(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    try {
      const created = await postRule(form);
      setRules((prev) => [...prev, created]);
      setForm({ name: '', enabled: true, conditionType: 'temperature_threshold', deviceId: '' });
    } catch (err) {
      setFormError(err.message);
    }
  };

  if (loading) return <div className="loading">Loading rules…</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <section className="rules">
      <h1>Rules</h1>
      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Enabled</th>
            <th>Condition Type</th>
            <th>Device ID</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((r, idx) => (
            <tr key={idx}>
              <td>{r.name}</td>
              <td>{r.enabled ? 'Yes' : 'No'}</td>
              <td>{r.conditionType}</td>
              <td>{r.deviceId || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Create New Rule</h2>
      {formError && <div className="error">{formError}</div>}
      <form onSubmit={handleSubmit} className="rule-form">
        <label>
          Name:
          <input type="text" name="name" value={form.name} onChange={handleChange} required />
        </label>
        <label>
          Enabled:
          <input type="checkbox" name="enabled" checked={form.enabled} onChange={handleChange} />
        </label>
        <label>
          Condition Type:
          <select name="conditionType" value={form.conditionType} onChange={handleChange} required>
            <option value="temperature_threshold">Temperature Threshold</option>
            <option value="event_type">Event Type</option>
            <option value="device_offline">Device Offline</option>
          </select>
        </label>
        <label>
          Device ID (optional):
          <input type="text" name="deviceId" value={form.deviceId} onChange={handleChange} />
        </label>
        <button type="submit">Create Rule</button>
      </form>
    </section>
  );
}

export default Rules;
