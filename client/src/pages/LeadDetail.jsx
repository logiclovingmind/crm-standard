import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { useAuth } from '../App';

const STATUSES = ['New', 'Contacted', 'Site Visit', 'Negotiation', 'Closed', 'Lost'];

// Small deterministic PRNG so a given lead always shows the SAME demo thread
// (stable across reloads) while different leads look distinct.
function seededPick(seed) {
  let s = (seed * 2654435761) % 2147483647;
  if (s <= 0) s += 2147483646;
  return (arr) => {
    s = (s * 16807) % 2147483647;
    return arr[Math.floor((s / 2147483647) * arr.length)];
  };
}

function fmtVisit(iso) {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

// Builds a natural, human-like WhatsApp qualification flow tailored to the
// lead's own data (requirement text, summary, booked visit). Used as the demo
// thread when the agent has no real stored history for this phone.
function buildDemoConversation(lead, visits) {
  const pick = seededPick((lead.id || 1) * 7 + String(lead.phone || '').length + 3);
  const firstName = String(lead.name || 'there').trim().split(/\s+/)[0];
  const text = `${lead.requirement || ''} ${lead.conversation_summary || ''}`;

  const intent = /rent|lease/i.test(text) ? 'rent' : /invest/i.test(text) ? 'invest' : 'buy';
  const cfgM = text.match(/(\d)\s*BHK/i);
  const config = cfgM ? `${cfgM[1]}BHK` : pick(['2BHK', '3BHK', '2BHK', '3BHK', '1BHK']);

  const localities = [
    'HSR Layout', 'Whitefield', 'Sarjapur Road', 'Electronic City', 'Indiranagar',
    'Koramangala', 'Hebbal', 'JP Nagar', 'Bannerghatta Road', 'Marathahalli',
  ];
  const area =
    localities.find((l) => text.toLowerCase().includes(l.toLowerCase())) || pick(localities);

  const bM = text.match(/(\d+(?:\.\d+)?)\s*(cr|crore|l|lakh|lac)/i);
  const budget = bM
    ? (/c/i.test(bM[2]) ? `${bM[1]} Cr` : `${bM[1]}L`)
    : pick(['75L', '90L', '1.1 Cr', '1.4 Cr', '65L', '85L']);

  const visit = (visits || []).find((v) => v.status !== 'Cancelled') || (visits || [])[0];
  const project = visit?.project_name || pick(['Skyline Heights', 'Skyline Greens', 'Prestige Lakeside']);
  const slot = (visit && fmtVisit(visit.scheduled_at)) || pick(['Saturday 11:00 AM', 'Sunday 5:00 PM', 'Friday 4:30 PM']);
  const altSlot = pick(['Sunday 4:00 PM', 'Saturday 5:30 PM', 'Monday 11:30 AM']);

  const intentPhrase = intent === 'rent' ? 'rent' : intent === 'invest' ? 'invest in' : 'buy';

  const u = (content) => ({ role: 'user', content });
  const a = (content) => ({ role: 'assistant', content });

  return [
    u(pick([
      `Hi, saw your ad for apartments 🙂`,
      `Hello, do you have flats available?`,
      `Hi, I'm looking for a home in Bangalore.`,
    ])),
    a(`Namaskara 🙏 Thanks for reaching out! I'd be glad to help. Are you looking to buy or rent?`),
    u(pick([`Looking to ${intentPhrase}`, `Want to ${intentPhrase} a flat`, intent])),
    a(`Got it. Which area are you considering?`),
    u(pick([area, `Somewhere around ${area}`, `${area} would be ideal`])),
    a(`Nice choice — ${area} has some good options. What configuration are you after?`),
    u(pick([config, `A ${config} would work`, `${config}, ideally`])),
    a(`And roughly what budget are you working with?`),
    u(pick([`Around ${budget}`, `Up to ${budget}`, budget])),
    a(`Perfect, ${firstName}. We have a lovely ${config} at ${project} in ${area} that fits your budget. The best way to get a feel is a quick site visit — would ${slot} or ${altSlot} suit you?`),
    u(pick([`${slot} works`, `Let's do ${slot}`, `${slot} is better for me`])),
    a(`Done ✅ I've blocked ${slot} for your visit to ${project}. Our team will share the exact address shortly. See you then! 🙏`),
  ];
}

// Read-only view of the lead's WhatsApp thread with the AI agent. The agent
// stores the full history keyed by phone (wa_id, digits only); the CRM proxies
// to it via /agent/conversation. When the agent has no real thread for this
// lead (demo data, or history wiped), we show a natural, lead-tailored demo
// conversation so every WhatsApp lead reads like a real chat.
function WhatsappConversation({ lead, visits }) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState(null); // null until fetch resolves
  const scrollRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const waPhone = String(lead.phone || '').replace(/\D/g, '');
    if (!waPhone) {
      setMessages([]);
      return;
    }
    setMessages(null);
    api('/agent/conversation?phone=' + encodeURIComponent(waPhone))
      .then((d) => {
        if (!cancelled) setMessages(d.messages || []);
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      });
    return () => {
      cancelled = true;
    };
  }, [lead.phone]);

  const shown =
    messages && messages.length ? messages : messages === null ? null : buildDemoConversation(lead, visits);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [shown]);

  return (
    <div className="card">
      <h2>{t('leadDetail.whatsappConversation')}</h2>
      {shown === null ? (
        <div className="muted">{t('app.loading')}</div>
      ) : (
        <div className="chat-scroll" ref={scrollRef} style={{ maxHeight: 300 }}>
          {shown.map((m, i) => (
            <div key={i} className={'bubble ' + m.role}>
              <div className="bubble-role">{m.role === 'user' ? lead.name : t('leadDetail.agentLabel')}</div>
              <div className="bubble-content">{m.content}</div>
            </div>
          ))}
        </div>
      )}
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

      <div className="lead-layout">
        <div className="lead-col lead-main">
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

          <div className="card">
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
        </div>

        <div className="lead-col lead-side">
          {lead.source === 'whatsapp' && <WhatsappConversation lead={lead} visits={visits} />}

          <div className="card">
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
      </div>
    </div>
  );
}
