import React, { createContext, useContext, useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import i18n from './i18n';
import { setCsrf } from './api';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import LeadDetail from './pages/LeadDetail';
import Inventory from './pages/Inventory';
import Visits from './pages/Visits';
import Users from './pages/Users';
import Train from './pages/Train';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export default function App() {
  const [me, setMe] = useState(undefined);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return setMe(null);
        const data = await res.json();
        setCsrf(data.csrfToken);
        i18n.changeLanguage(data.user.language);
        setMe(data.user);
      })
      .catch(() => setMe(null));
  }, []);

  if (me === undefined) return null;
  if (!me) {
    return (
      <Login
        onLogin={(user) => {
          i18n.changeLanguage(user.language);
          setMe(user);
        }}
      />
    );
  }

  return (
    <AuthContext.Provider value={{ me, setMe }}>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/leads/:id" element={<LeadDetail />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/visits" element={<Visits />} />
          {me.role === 'owner' && <Route path="/users" element={<Users />} />}
          <Route path="/train" element={<Train />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </AuthContext.Provider>
  );
}
