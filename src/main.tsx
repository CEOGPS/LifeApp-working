import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './AppRoutes';
import './index.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SupabaseProvider } from './lib/supabase';
import { AuthProvider } from './lib/SupabaseAuthContext';
import { MusicProvider } from './lib/MusicContext';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <SupabaseProvider>
        <AuthProvider>
          <MusicProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </MusicProvider>
        </AuthProvider>
      </SupabaseProvider>
    </QueryClientProvider>
  </React.StrictMode>
);