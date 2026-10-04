// src/lib/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';

// Mock DB for local development
const mockDb = {
  auth: {
    me: async () => ({ id: '1', email: 'user@example.com', role: 'admin' }),
    logout: () => {},
    redirectToLogin: (redirect) => { window.location.href = '/login'; },
    loginViaEmailPassword: async (email, password) => {},
    loginWithProvider: (provider, redirect) => {},
    register: async (data) => {},
    verifyOtp: async (data) => ({ access_token: 'mock-token' }),
    resendOtp: async (email) => {},
    resetPasswordRequest: async (email) => {},
    resetPassword: async (data) => {},
    setToken: (token) => {}
  },
  entities: {
    UserProfile: {
      list: async () => [],
      create: async (data) => ({ id: '1', ...data }),
      update: async (id, data) => ({ id, ...data })
    },
    Strategy: {
      list: async () => [],
      update: async (id, data) => ({ id, ...data })
    },
    Campaign: {
      list: async () => [],
      update: async (id, data) => ({ id, ...data })
    },
    ActivityLog: {
      list: async () => [],
      create: async (data) => ({ id: '1', ...data })
    },
    FinancialAccount: {
      list: async () => []
    }
  },
  integrations: {
    Core: {
      UploadFile: async () => ({ file_url: '' })
    }
  }
};

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  useEffect(() => {
    checkUserAuth();
  }, []);

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      // For demo purposes, auto-authenticate
      const currentUser = await mockDb.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthChecked(true);
    } catch (error) {
      setIsAuthenticated(false);
      setAuthChecked(true);
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect) {
      window.location.href = '/login';
    }
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState: () => {}
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Export mock db for components
export const db = mockDb;