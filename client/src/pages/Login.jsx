import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, setCsrf } from '../api';

export default function Login({ onLogin }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await api('/auth/login', { method: 'POST', body: { email, password } });
      setCsrf(data.csrfToken);
      onLogin(data.user);
    } catch (err) {
      setError(err.status === 401 ? t('login.failed') : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <form className="card login-box" onSubmit={submit}>
        <h1>{t('login.title')}</h1>
        <input
          type="email"
          placeholder={t('common.email')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />
        <input
          type="password"
          placeholder={t('common.password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <div className="error">{error}</div>}
        <button className="primary" disabled={busy}>
          {t('login.submit')}
        </button>
      </form>
    </div>
  );
}
