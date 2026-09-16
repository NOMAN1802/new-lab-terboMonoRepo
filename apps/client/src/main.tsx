import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { Toaster } from 'sonner';
import './index.css';
import App from './App';
import { LanguageProvider } from '@/i18n/LanguageProvider';
import { store } from './app/store';

// Suppress React DevTools proxy.js errors (harmless extension errors)
const originalError = console.error;
console.error = (...args: unknown[]) => {
  const errorMessage = typeof args[0] === 'string' ? args[0] : String(args[0] || '');
  if (
    errorMessage.includes('proxy.js') ||
    errorMessage.includes('Attempting to use a disconnected port') ||
    errorMessage.includes('react_devtools_backend')
  ) {
    return; // Suppress React DevTools extension errors
  }
  originalError.apply(console, args);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <LanguageProvider>
        <BrowserRouter>
          <App />
          <Toaster position="top-right" richColors />
        </BrowserRouter>
      </LanguageProvider>
    </Provider>
  </StrictMode>
);
