const API_URL = import.meta.env.VITE_API_URL?.replace(/\/+$/, '');

export const fetchJson = async (path, options = {}) => {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Network error');
  }
  return res.json();
};

export const getDevices = () => fetchJson('/devices');
export const getEvents = (page = 1, limit = 20) => fetchJson(`/events?page=${page}&limit=${limit}`);
export const getRules = () => fetchJson('/rules');
export const postRule = (rule) => fetchJson('/rules', { method: 'POST', body: JSON.stringify(rule) });
export const getIncidents = (page = 1, limit = 20) => fetchJson(`/incidents?page=${page}&limit=${limit}`);
export const patchIncident = (id, updates) => fetchJson(`/incidents/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
