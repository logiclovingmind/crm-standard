import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api';

// Talk to the WhatsApp agent from inside the CRM. Same handleMessage() loop
// the real webhook uses, so replies here match what a real lead would get.
// Left: chat transcript keyed by a "sim-<x>" phone. Right: live snapshot of
// the extracted lead state so you can see fields land as the conversation
// progresses. Reset button wipes the phone's conversation state on the agent.

function defaultPhone() {
  const saved = localStorage.getItem('crm.train.phone');
  if (saved) return saved;
  const p = 'sim-' + Math.random().toString(36).slice(2, 8);
  localStorage.setItem('crm.train.phone', p);
  return p;
}

export default function Train() {
  const [phone, setPhone] = useState(defaultPhone);
  const [messages, setMessages] = useState([]);
  const [state, setState] = useState(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('crm.train.phone', phone);
    loadConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  async function loadConversation() {
    setLoading(true);
    setError(null);
    try {
      const data = await api('/agent/conversation?phone=' + encodeURIComponent(phone));
      setMessages(data.messages || []);
      setState(data.state || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function send(e) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setDraft('');
    setBusy(true);
    setError(null);
    const optimistic = [...messages, { role: 'user', content: text }];
    setMessages(optimistic);
    try {
      const data = await api('/agent/chat', { method: 'POST', body: { phone, message: text } });
      setMessages([...optimistic, { role: 'assistant', content: data.reply }]);
      setState(data.state || null);
    } catch (err) {
      setError(err.message);
      setMessages(messages);
      setDraft(text);
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!confirm(`Reset conversation for ${phone}?`)) return;
    setBusy(true);
    setError(null);
    try {
      await api('/agent/reset', { method: 'POST', body: { phone } });
      setMessages([]);
      setState(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function newSession() {
    const p = 'sim-' + Math.random().toString(36).slice(2, 8);
    setPhone(p);
  }

  return (
    <div className="train-page">
      <div className="train-header">
        <div>
          <h1>Train agent</h1>
          <p className="muted">
            Chat with the WhatsApp agent as if you were a lead. Same code path as
            production — extracted fields and stage update live on the right.
          </p>
        </div>
        <div className="train-controls">
          <label className="phone-field">
            <span>Phone</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value.trim())}
              onBlur={loadConversation}
            />
          </label>
          <button className="link" onClick={newSession} disabled={busy}>New session</button>
          <button className="link danger" onClick={reset} disabled={busy || messages.length === 0}>Reset</button>
        </div>
      </div>

      {error && <div className="error card">{error}</div>}

      <div className="train-body">
        <div className="chat card">
          <div className="chat-scroll" ref={scrollRef}>
            {loading ? (
              <div className="muted">Loading…</div>
            ) : messages.length === 0 ? (
              <div className="muted">No messages yet. Say hi.</div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={'bubble ' + m.role}>
                  <div className="bubble-role">{m.role === 'user' ? 'You' : 'Agent'}</div>
                  <div className="bubble-content">{m.content}</div>
                </div>
              ))
            )}
            {busy && <div className="bubble assistant typing"><em>Agent is thinking…</em></div>}
          </div>
          <form className="chat-composer" onSubmit={send}>
            <input
              placeholder="Type a message and press Enter"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={busy}
              autoFocus
            />
            <button className="primary" type="submit" disabled={busy || !draft.trim()}>Send</button>
          </form>
        </div>

        <aside className="state-panel card">
          <h3>Lead state</h3>
          {state ? (
            <>
              <div className="state-row"><span>Stage</span><strong>{state.stage || '—'}</strong></div>
              <div className="state-row"><span>Messages</span><strong>{state.messageCount ?? 0}</strong></div>
              {state.crm?.leadId != null && (
                <div className="state-row"><span>CRM lead id</span><strong>#{state.crm.leadId}</strong></div>
              )}
              <h4>Fields</h4>
              {Object.keys(state.fields || {}).length === 0 ? (
                <div className="muted">None captured yet</div>
              ) : (
                <table className="fields-table">
                  <tbody>
                    {Object.entries(state.fields).map(([k, v]) => (
                      <tr key={k}>
                        <td>{k}</td>
                        <td>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          ) : (
            <div className="muted">Send a message to see extracted state.</div>
          )}
        </aside>
      </div>
    </div>
  );
}
