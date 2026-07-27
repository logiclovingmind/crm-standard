import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api';

// Demo-only keep-awake for the whole system (CRM + WhatsApp agent). When on,
// the browser polls /api/status/system every 5 min: that request keeps the
// CRM warm and its server-side ping keeps the agent warm too. Off by default.
const STORAGE_KEY = 'crm.keepAwake';
const INTERVAL_MS = 5 * 60 * 1000;

export default function KeepAwake() {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(STORAGE_KEY) === '1');
  const [status, setStatus] = useState(null); // { crm, agent } | null
  const timerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
    if (!enabled) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      setStatus(null);
      return;
    }
    const ping = async () => {
      try {
        const data = await api('/status/system');
        setStatus({ crm: data.crm, agent: data.agent });
      } catch {
        setStatus({ crm: 'down', agent: 'unknown' });
      }
    };
    ping();
    timerRef.current = setInterval(ping, INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [enabled]);

  let dotClass = 'off';
  let title = 'Keep-awake off';
  if (enabled) {
    if (!status) {
      dotClass = 'pending';
      title = 'Pinging…';
    } else if (status.crm === 'up' && status.agent === 'up') {
      dotClass = 'live';
      title = 'OS live · Agent live';
    } else if (status.crm === 'up' && status.agent === 'unknown') {
      dotClass = 'live';
      title = 'OS live · Agent status unknown (AGENT_URL not set)';
    } else {
      dotClass = 'down';
      title = `OS ${status.crm} · Agent ${status.agent}`;
    }
  }

  return (
    <div className="keep-awake">
      <label>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        <span>Keep-awake</span>
      </label>
      <span className={'ka-dot ' + dotClass} title={title} aria-label={title} />
    </div>
  );
}
