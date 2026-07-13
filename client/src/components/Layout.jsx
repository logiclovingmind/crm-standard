import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { useAuth } from '../App';

export default function Layout({ children }) {
  const { t, i18n } = useTranslation();
  const { me } = useAuth();

  async function switchLanguage(lang) {
    if (lang === i18n.language) return;
    i18n.changeLanguage(lang);
    try {
      await api('/auth/me/language', { method: 'PUT', body: { language: lang } });
    } catch {
      /* toggle still applies locally */
    }
  }

  async function logout() {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      window.location.href = '/';
    }
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <svg viewBox="0 0 1024 1024" fill="currentColor" width="14" height="14" style={{ verticalAlign: '-2px', marginRight: 8 }}>
            <path d="M303.23 274.23c14.82-15.13 29.4-30.01 43.97-44.89 10.15-10.36 29.49-10.53 39.45-.43 27.37 27.77 54.8 55.48 82.15 83.26 12.16 12.35 24.17 24.84 36.3 37.22 6.68 6.81 12.15 6.79 18.79.02 38.05-38.77 76.61-77.06 113.79-116.65 11.42-12.16 29.41-13.48 39.18-6.95 4.66 3.11 7.93 7.59 11.77 11.5 30.83 31.38 61.54 62.88 92.38 94.24 6.36 6.46 9.2 14.14 9.21 22.99.04 47.49.02 94.99.01 142.48 0 9.08-3.09 16.72-9.6 23.3-56.74 57.31-113.4 114.7-170.03 172.12-25.51 25.86-50.89 51.84-76.36 77.74-9.92 10.08-27.48 10.17-37.49.13-33.17-33.27-66.24-66.65-99.45-99.9-40.51-40.55-81.11-81.01-121.69-121.49-9.79-9.77-19.68-19.43-29.43-29.23-5.52-5.55-8.47-12.32-8.47-20.19-.03-48.66-.03-97.32-.03-145.98 0-8.23 2.92-15.21 8.71-21.12 18.9-19.27 37.73-38.61 56.84-58.17z" />
          </svg>
          {t('app.title')}
        </div>
        <nav>
          <NavLink to="/" end>{t('nav.dashboard')}</NavLink>
          <NavLink to="/leads">{t('nav.leads')}</NavLink>
          <NavLink to="/inventory">{t('nav.inventory')}</NavLink>
          <NavLink to="/visits">{t('nav.visits')}</NavLink>
          {me.role === 'owner' && <NavLink to="/users">{t('nav.users')}</NavLink>}
        </nav>
        <div className="spacer" />
        <div className="footer">
          <div className="who">
            {me.name} · {t(`role.${me.role}`)}
          </div>
          <div className="lang-toggle" style={{ marginBottom: 8 }}>
            <button className={i18n.language === 'en' ? 'active' : ''} onClick={() => switchLanguage('en')}>
              EN
            </button>
            <button className={i18n.language === 'kn' ? 'active' : ''} onClick={() => switchLanguage('kn')}>
              ಕನ್ನಡ
            </button>
          </div>
          <button className="link" onClick={logout}>
            {t('nav.logout')}
          </button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
