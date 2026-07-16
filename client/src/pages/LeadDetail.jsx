import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { useAuth } from '../App';

const STATUSES = ['New', 'Contacted', 'Site Visit', 'Negotiation', 'Closed', 'Lost'];

// Read-only view of the lead's WhatsApp thread with the AI agent. The agent
// stores the full history keyed by phone (wa_id, digits only); the CRM proxies
// to it via /agent/conversation. Unavailable is not an error — the agent may be
// unconfigured (AGENT_URL unset) or this lead may have no thread yet.
function WhatsappConversation({ lead }) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ok | unavailable
  const scrollRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const waPhone = String(lead.phone || '').replace(/\D/g, '');
    if (!waPhone) {
      setStatus('unavailable');
      return;
    }
    setStatus('loading');
    api('/agent/conversation?phone=' + encodeURIComponent(waPhone))
      .then((d) => {
        if (cancelled) return;
        setMessages(d.messages || []);
        setStatus('ok');
      })
      .catch(() => {
        if (!cancelled) setStatus('unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, [lead.phone]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, status]);

  return (
    <div className="card">
      <h2>{t('leadDetail.whatsappConversation')}</h2>
      {status === 'loading' && <div className="muted">{t('app.loading')}</div>}
      {status === 'unavailable' && <div className="muted">{t('leadDetail.conversationUnavailable')}</div>}
      {status === 'ok' &&
        (messages.length === 0 ? (
          <div className="muted">{t('leadDetail.noConversation')}</div>
        ) : (
          <div className="chat-scroll" ref={scrollRef} style={{ maxHeight: 360 }}>
            {messages.map((m, i) => (
              <div key={i} className={'bubble ' + m.role}>
                <div className="bubble-role">{m.role === 'user' ? lead.name : t('leadDetail.agentLabel')}</div>
                <div className="bubble-content">{m.content}</div>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}

export default function LeadDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { me } = useAuth();
  const canAssign = me.role === 'owner' || me.role === 'manager';

  const [data, setData] = useState(null);
  const [dealValue, setDealValue] = useState('');
  const [note, setNote] = useState('');
  const [assignable, setAssignable] = useState([]);
  const [units, setUnits] = useState([]);
  const [visitAt, setVisitAt] = useState('');
  const [linkUnitId, setLinkUnitId] = useState('');
  const [error, setError] = useState(null);

  async function load() {
    const d = await api(`/leads/${id}`);
    setData(d);
    setDealValue(d.lead.deal_value ?? '');
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
    api('/inventory/units').then((d) => setUnits(d.units)).catch(() => {});
    if (canAssign) api('/users/assignable').then((d) => setAssignable(d.users)).catch(() => {});
  }, [id]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">{t('app.loading')}</p>;
  const { lead, notes, activity, visits } = data;

  const act = (fn) => fn().then(load).catch((err) => setError(err.message));

  return (
    <div>
      <h1>
        {lead.name} <span className="muted" style={{ fontSize: 15 }}>{lead.phone}</span>
      </h1>

      <div className="card">
        <div className="form-row">
          <label>{t('common.status')}</label>
          <select
            value={lead.status}
            onChange={(e) => act(() => api(`/leads/${id}`, { method: 'PUT', body: { status: e.target.value } }))}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{t(`status.${s}`)}</option>
            ))}
          </select>
          <span className="muted">{t('common.source')}: {t(`source.${lead.source}`)}</span>
          {canAssign ? (
            <>
              <label>{t('leadDetail.assign')}</label>
              <select
                value={lead.assigned_to || ''}
                onChange={(e) =>
                  act(() =>
                    api(`/leads/${id}/assign`, {
                      method: 'PUT',
                      body: { assigned_to: e.target.value ? Number(e.target.value) : null },
                    })
                  )
                }
              >
                <option value="">{t('common.unassigned')}</option>
                {assignable.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </>
          ) : (
            <span className="muted">
              {t('common.assignedTo')}: {lead.assigned_name || t('common.unassigned')}
            </span>
          )}
        </div>
        <div className="form-row">
          <label>{t('leadDetail.dealValue')}</label>
          <input
            type="number"
            min="0"
            placeholder={t('leadDetail.dealValuePlaceholder')}
            value={dealValue}
            onChange={(e) => setDealValue(e.target.value)}
            onBlur={() => {
              const next = dealValue === '' ? null : Number(dealValue);
              if (next === (lead.deal_value ?? null)) return;
              act(() => api(`/leads/${id}`, { method: 'PUT', body: { deal_value: next } }));
            }}
          />
          <span className="muted">{t('leadDetail.dealValueHint')}</span>
        </div>
        {lead.requirement && <p>{t('leads.requirement')}: {lead.requirement}</p>}
        {lead.conversation_summary && (
          <p className="muted">{t('leadDetail.conversationSummary')}: {lead.conversation_summary}</p>
        )}
      </div>

      {lead.source === 'whatsapp' && <WhatsappConversation lead={lead} />}

      <div className="cards-row">
        <div className="card" style={{ flex: 2 }}>
          <h2>{t('leadDetail.notes')}</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!note.trim()) return;
              act(() => api(`/leads/${id}/notes`, { method: 'POST', body: { body: note } })).then(() => setNote(''));
            }}
          >
            <textarea rows={2} placeholder={t('leadDetail.notePlaceholder')} value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="primary" style={{ marginTop: 6 }}>{t('leadDetail.addNote')}</button>
          </form>
          {notes.map((n) => (
            <div className="note" key={n.id}>
              <div>{n.body}</div>
              <div className="meta">{n.author} · {n.created_at.slice(0, 16).replace('T', ' ')}</div>
            </div>
          ))}
        </div>

        <div className="card" style={{ flex: 1 }}>
          <h2>{t('leadDetail.activity')}</h2>
          {activity.map((a) => (
            <div className="timeline-item" key={a.id}>
              <strong>{a.type}</strong>
              {a.from_status && a.to_status && ` ${t(`status.${a.from_status}`)} → ${t(`status.${a.to_status}`)}`}
              {a.detail && <div className="muted">{a.detail}</div>}
              <div className="muted">{a.user_name || 'bot'} · {a.created_at.slice(0, 16).replace('T', ' ')}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="cards-row">
        <div className="card">
          <h2>{t('leadDetail.unitsOfInterest')}</h2>
          {data.units.map((u) => (
            <div className="form-row" key={u.id}>
              <span>{u.project_name} / {u.identifier} ({t(`unitType.${u.type}`)})</span>
              <button
                className="link danger"
                onClick={() => act(() => api(`/leads/${id}/units/${u.id}`, { method: 'DELETE' }))}
              >
                {t('leadDetail.remove')}
              </button>
            </div>
          ))}
          <div className="form-row">
            <select value={linkUnitId} onChange={(e) => setLinkUnitId(e.target.value)}>
              <option value="">{t('leadDetail.linkUnit')}</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.project_name} / {u.identifier}
                </option>
              ))}
            </select>
            <button
              disabled={!linkUnitId}
              onClick={() =>
                act(() => api(`/leads/${id}/units`, { method: 'POST', body: { unit_id: Number(linkUnitId) } })).then(() =>
                  setLinkUnitId('')
                )
              }
            >
              {t('common.add')}
            </button>
          </div>
        </div>

        <div className="card">
          <h2>{t('leadDetail.visits')}</h2>
          {visits.map((v) => (
            <div className="timeline-item" key={v.id}>
              {v.scheduled_at.slice(0, 16).replace('T', ' ')} · {t(`visitStatus.${v.status}`)}
              {v.project_name && <span className="muted"> · {v.project_name}</span>}
            </div>
          ))}
          <div className="form-row" style={{ marginTop: 8 }}>
            <input type="datetime-local" value={visitAt} onChange={(e) => setVisitAt(e.target.value)} />
            <button
              disabled={!visitAt}
              onClick={() =>
                act(() =>
                  api('/visits', {
                    method: 'POST',
                    body: { lead_id: Number(id), scheduled_at: visitAt + ':00+05:30' },
                  })
                ).then(() => setVisitAt(''))
              }
            >
              {t('leadDetail.scheduleVisit')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
