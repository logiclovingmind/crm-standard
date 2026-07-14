import React, { useEffect, useRef, useState } from 'react';

// Demo-only keep-awake: when the toggle is on, the browser tab pings
// /api/health every 5 min so Render's free tier doesn't spin the CRM down
// mid-presentation. Purely client-side (localStorage), default off.
const STORAGE_KEY = 'crm.keepAwake';
const INTERVAL_MS = 5 * 60 * 1000;

export default function KeepAwake() {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(STORAGE_KEY) === '1');
  const [live, setLive] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
    if (!enabled) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      setLive(null);
      return;
    }
    const ping = async () => {
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        setLive(res.ok);
      } catch {
        setLive(false);
      }
    };
    ping();
    timerRef.current = setInterval(ping, INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [enabled]);

  const dotClass = !enabled ? 'off' : live === true ? 'live' : live === false ? 'down' : 'pending';
  const dotTitle = !enabled
    ? 'Keep-awake off'
    : live === true
      ? 'Live'
      : live === false
        ? 'No response'
        : 'Pinging…';

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
      <span className={'ka-dot ' + dotClass} title={dotTitle} aria-label={dotTitle} />
    </div>
  );
}
