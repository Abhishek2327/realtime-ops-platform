const DEFAULT_API_URL = 'http://localhost:5002/api';
const API_URL = (import.meta.env.VITE_API_URL?.replace(/\/+$/, '') ?? DEFAULT_API_URL);

export const fetchJson = async (path, options = {}) => {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    // Read body once as text, then try to parse as JSON
    const body = await res.text().catch(() => '');
    let errMsg = res.statusText;
    try {
      const errJson = JSON.parse(body);
      errMsg = errJson.error || JSON.stringify(errJson);
    } catch (_) {
      if (body && !body.startsWith('<!')) {
        errMsg = body;
      }
    }
    throw new Error(errMsg || 'Network error');
  }
  return res.json();
};

export const getDevices = () => fetchJson('/devices');
export const getEvents = (page = 1, limit = 20) => fetchJson(`/events?page=${page}&limit=${limit}`);
export const getRules = () => fetchJson('/rules');
export const postRule = (rule) => fetchJson('/rules', { method: 'POST', body: JSON.stringify(rule) });
export const getIncidents = (page = 1, limit = 20) => fetchJson(`/incidents?page=${page}&limit=${limit}`);
export const patchIncident = (id, updates) => fetchJson(`/incidents/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
