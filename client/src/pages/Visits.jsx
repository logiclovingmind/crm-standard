import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api';

const VISIT_STATUSES = ['scheduled', 'completed', 'no-show', 'cancelled'];

export default function Visits() {
  const { t } = useTranslation();
  const [visits, setVisits] = useState([]);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState(null);

  async function load() {
    const qs = filter ? `?status=${filter}` : '';
    setVisits((await api('/visits' + qs)).visits);
  }

  useEffect(() => {
    load().catch(console.error);
  }, [filter]);

  return (
    <div>
      <h1>{t('visits.title')}</h1>
      {error && <div className="error">{error}</div>}

      <div className="filters">
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">{t('common.all')}</option>
          {VISIT_STATUSES.map((s) => (
            <option key={s} value={s}>{t(`visitStatus.${s}`)}</option>
          ))}
        </select>
      </div>

      <div className="card">
        {visits.length === 0 ? (
          <p className="muted">{t('app.noResults')}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t('visits.scheduledAt')}</th>
                <th>{t('visits.lead')}</th>
                <th>{t('visits.agent')}</th>
                <th>{t('visits.project')}</th>
                <th>{t('visits.unit')}</th>
                <th>{t('common.status')}</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => (
                <tr key={v.id}>
                  <td>{v.scheduled_at.slice(0, 16).replace('T', ' ')}</td>
                  <td><Link to={`/leads/${v.lead_id}`}>{v.lead_name}</Link></td>
                  <td>{v.agent_name || '—'}</td>
                  <td>{v.project_name || '—'}</td>
                  <td>{v.unit_identifier || '—'}</td>
                  <td>
                    <select
                      value={v.status}
                      onChange={(e) =>
                        api(`/visits/${v.id}`, { method: 'PUT', body: { status: e.target.value } })
                          .then(load)
                          .catch((err) => setError(err.message))
                      }
                    >
                      {VISIT_STATUSES.map((s) => (
                        <option key={s} value={s}>{t(`visitStatus.${s}`)}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
