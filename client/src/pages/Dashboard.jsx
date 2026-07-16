import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api';

function Bars({ data, labelFn }) {
  const max = Math.max(...data.map((d) => d.n), 1);
  return (
    <div>
      {data.map((d) => (
        <div className="bar-row" key={d.key}>
          <span className="label">{labelFn(d.key)}</span>
          <div className="bar-track">
            <div className="bar" style={{ width: `${(d.n / max) * 100}%` }} />
          </div>
          <span>{d.n}</span>
        </div>
      ))}
    </div>
  );
}

// Source bars annotated with the conversion % (closed / total) — the
// "which channel actually produces deals" view.
function SourceBars({ data, labelFn }) {
  const max = Math.max(...data.map((d) => d.n), 1);
  return (
    <div>
      {data.map((d) => (
        <div className="bar-row" key={d.key}>
          <span className="label">{labelFn(d.key)}</span>
          <div className="bar-track">
            <div className="bar" style={{ width: `${(d.n / max) * 100}%` }} />
          </div>
          <span>{d.n}</span>
          <span className="muted" style={{ marginLeft: 8 }}>{d.conversion}%</span>
        </div>
      ))}
    </div>
  );
}

// Compact Indian money format for large real-estate deal values.
function formatINR(amount) {
  const n = Number(amount) || 0;
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function Dashboard() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState(null);
  const [stale, setStale] = useState([]);

  useEffect(() => {
    api('/dashboard/summary').then(setSummary).catch(console.error);
    api('/dashboard/stale').then((d) => setStale(d.leads)).catch(console.error);
  }, []);

  if (!summary) return <p className="muted">{t('app.loading')}</p>;

  const STATUS_ORDER = ['New', 'Contacted', 'Site Visit', 'Negotiation', 'Closed', 'Lost'];
  const funnel = STATUS_ORDER.map((s) => ({ key: s, n: summary.funnel.find((f) => f.status === s)?.n || 0 }));
  const sources = summary.sources.map((s) => ({ key: s.source, n: s.n, conversion: s.conversion ?? 0 }));
  const closed = summary.closedThisMonth || { deals: 0, revenue: 0 };

  return (
    <div>
      <h1>{t('dashboard.title')}</h1>

      {summary.backup && !summary.backup.ok && (
        <div className="banner-warn">{t('dashboard.backupWarning', { message: summary.backup.message })}</div>
      )}

      <div className="cards-row">
        <div className="card">
          <h2>{t('dashboard.leadsThisMonth')}</h2>
          <div className="stat">{summary.leadsThisMonth}</div>
          <div className="stat-sub">{t('dashboard.lastMonth', { count: summary.leadsLastMonth })}</div>
        </div>
        <div className="card">
          <h2>{t('dashboard.closedThisMonth')}</h2>
          <div className="stat">{formatINR(closed.revenue)}</div>
          <div className="stat-sub">{t('dashboard.dealsClosed', { count: closed.deals })}</div>
        </div>
        <div className="card">
          <h2>{t('dashboard.staleCount')}</h2>
          <div className="stat">{summary.staleCount}</div>
          <div className="stat-sub">{t('dashboard.staleLeads')}</div>
        </div>
      </div>

      <div className="cards-row">
        <div className="card">
          <h2>{t('dashboard.funnel')}</h2>
          <Bars data={funnel} labelFn={(k) => t(`status.${k}`)} />
        </div>
        <div className="card">
          <h2>{t('dashboard.sourceBreakdown')}</h2>
          {sources.length ? <SourceBars data={sources} labelFn={(k) => t(`source.${k}`)} /> : <p className="muted">{t('app.noResults')}</p>}
        </div>
      </div>

      <div className="card">
        <h2>{t('dashboard.staleLeads')}</h2>
        {stale.length === 0 ? (
          <p className="muted">{t('app.noResults')}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t('common.name')}</th>
                <th>{t('common.phone')}</th>
                <th>{t('common.status')}</th>
                <th>{t('common.assignedTo')}</th>
                <th>{t('dashboard.lastActivity')}</th>
              </tr>
            </thead>
            <tbody>
              {stale.map((l) => (
                <tr key={l.id}>
                  <td><Link to={`/leads/${l.id}`}>{l.name}</Link></td>
                  <td>{l.phone}</td>
                  <td><span className={`badge ${l.status.replace(' ', '')}`}>{t(`status.${l.status}`)}</span></td>
                  <td>{l.assigned_name || t('common.unassigned')}</td>
                  <td className="muted">{l.last_activity?.slice(0, 16).replace('T', ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
