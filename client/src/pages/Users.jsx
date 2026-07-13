import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';

const ROLES = ['owner', 'manager', 'agent'];

export default function Users() {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', role: 'agent' });
  const [error, setError] = useState(null);

  const load = () => api('/users').then((d) => setUsers(d.users));

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const run = (fn) => fn().then(load).catch((err) => setError(err.message));

  return (
    <div>
      <h1>{t('users.title')}</h1>
      {error && <div className="error">{error}</div>}

      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            await api('/users', { method: 'POST', body: form });
            setForm({ name: '', email: '', phone: '', password: '', role: 'agent' });
          });
        }}
      >
        <h2>{t('users.addUser')}</h2>
        <div className="form-row">
          <input placeholder={t('common.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input type="email" placeholder={t('common.email')} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <input placeholder={t('common.phone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input
            type="password"
            placeholder={t('common.password')}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            minLength={10}
            required
          />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {ROLES.map((r) => (
              <option key={r} value={r}>{t(`role.${r}`)}</option>
            ))}
          </select>
          <button className="primary">{t('common.add')}</button>
        </div>
      </form>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>{t('common.name')}</th>
              <th>{t('common.email')}</th>
              <th>{t('common.role')}</th>
              <th>{t('common.status')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{t(`role.${u.role}`)}</td>
                <td>{u.active ? t('users.active') : t('users.inactive')}</td>
                <td>
                  <button
                    className="link"
                    onClick={() => run(() => api(`/users/${u.id}`, { method: 'PUT', body: { active: u.active ? 0 : 1 } }))}
                  >
                    {u.active ? t('users.deactivate') : t('users.activate')}
                  </button>{' '}
                  <button
                    className="link"
                    onClick={() => {
                      const password = window.prompt(t('users.newPasswordPrompt'));
                      if (password) run(() => api(`/users/${u.id}/password`, { method: 'PUT', body: { password } }));
                    }}
                  >
                    {t('users.resetPassword')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
