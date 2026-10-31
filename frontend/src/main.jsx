import '@fontsource-variable/inter';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import './styles/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

import App from './App.jsx';
import { AuthProvider } from './auth/AuthProvider.jsx';
import { ToastProvider } from './components/Toast.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>
);
