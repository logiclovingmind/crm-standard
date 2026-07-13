import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { useAuth } from '../App';

const STATUSES = ['New', 'Contacted', 'Site Visit', 'Negotiation', 'Closed', 'Lost'];
const SOURCES = ['whatsapp', 'walk-in', '99acres', 'magicbricks', 'referral', 'other'];

export default function Leads() {
  const { t } = useTranslation();
  const { me } = useAuth();
  const [leads, setLeads] = useState([]);
  const [filters, setFilters] = useState({ q: '', status: '', source: '' });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', source: 'walk-in', requirement: '' });
  const [error, setError] = useState(null);

  async function load() {
    const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
    const data = await api('/leads?' + params.toString());
    setLeads(data.leads);
  }

  useEffect(() => {
    load().catch(console.error);
  }, [filters]);

  async function createLead(e) {
    e.preventDefault();
    setError(null);
    try {
      await api('/leads', { method: 'POST', body: form });
      setForm({ name: '', phone: '', source: 'walk-in', requirement: '' });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1>{t('leads.title')}</h1>

      <div className="filters">
        <input
          placeholder={t('common.search')}
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
        />
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">{t('common.all')} — {t('common.status')}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{t(`status.${s}`)}</option>
          ))}
        </select>
        <select value={filters.source} onChange={(e) => setFilters({ ...filters, source: e.target.value })}>
          <option value="">{t('common.all')} — {t('common.source')}</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>{t(`source.${s}`)}</option>
          ))}
        </select>
        <button className="primary" onClick={() => setShowForm(!showForm)}>
          {t('leads.newLead')}
        </button>
        {me.role === 'owner' && (
          <a href="/api/export/leads.xlsx">
            <button>{t('leads.exportExcel')}</button>
          </a>
        )}
      </div>

      {showForm && (
        <form className="card" onSubmit={createLead}>
          <div className="form-row">
            <input
              placeholder={t('common.name')}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <input
              placeholder={t('common.phone')}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              required
            />
            <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              {SOURCES.map((s) => (
                <option key={s} value={s}>{t(`source.${s}`)}</option>
              ))}
            </select>
            <input
              placeholder={t('leads.requirement')}
              value={form.requirement}
              onChange={(e) => setForm({ ...form, requirement: e.target.value })}
              style={{ flex: 1 }}
            />
            <button className="primary">{t('common.save')}</button>
          </div>
          {error && <div className="error">{error}</div>}
        </form>
      )}

      <div className="card">
        {leads.length === 0 ? (
          <p className="muted">{t('app.noResults')}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t('common.name')}</th>
                <th>{t('common.phone')}</th>
                <th>{t('common.status')}</th>
                <th>{t('common.source')}</th>
                <th>{t('common.assignedTo')}</th>
                <th>{t('leads.requirement')}</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  <td><Link to={`/leads/${l.id}`}>{l.name}</Link></td>
                  <td>{l.phone}</td>
                  <td><span className={`badge ${l.status.replace(' ', '')}`}>{t(`status.${l.status}`)}</span></td>
                  <td>{t(`source.${l.source}`)}</td>
                  <td>{l.assigned_name || t('common.unassigned')}</td>
                  <td className="muted">{l.requirement}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
