import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './i18n';
import '@fontsource/unbounded/500.css';
import '@fontsource/unbounded/700.css';
import '@fontsource/unbounded/800.css';
import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';
import './index.css';

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
