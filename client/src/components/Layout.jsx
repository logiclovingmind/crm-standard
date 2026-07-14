import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { useAuth } from '../App';
import { Logo } from './Brand';
import KeepAwake from './KeepAwake';

export default function Layout({ children }) {
  const { t, i18n } = useTranslation();
  const { me } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  React.useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

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
      <header className="mobile-header">
        <button
          className="hamburger"
          aria-label="Menu"
          onClick={() => setDrawerOpen(true)}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
          </svg>
        </button>
        <Logo size={22} />
        <span className="tier-badge">Standard</span>
      </header>
      <div
        className={'mobile-backdrop' + (drawerOpen ? ' open' : '')}
        onClick={() => setDrawerOpen(false)}
      />
      <aside className={'sidebar' + (drawerOpen ? ' open' : '')}>
        <div className="brand">
          <Logo size={30} />
          <span className="tier-badge">Standard</span>
        </div>
        <nav>
          <NavLink to="/" end>{t('nav.dashboard')}</NavLink>
          <NavLink to="/leads">{t('nav.leads')}</NavLink>
          <NavLink to="/inventory">{t('nav.inventory')}</NavLink>
          <NavLink to="/visits">{t('nav.visits')}</NavLink>
          {me.role === 'owner' && <NavLink to="/users">{t('nav.users')}</NavLink>}
          <NavLink to="/train">{t('nav.train')}</NavLink>
        </nav>
        <div className="spacer" />
        <div className="footer">
          <div className="who">
            {me.name} · {t(`role.${me.role}`)}
          </div>
          <KeepAwake />
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
          <div className="brand-credit">Logic Loving Mind · Standard · v0.1</div>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
