import React, { createContext, useContext } from 'react';

const AuthContext = createContext();

/**
 * AuthProvider — stub de acesso anônimo.
 *
 * isAuthenticated: false — estado correto para acesso anônimo.
 * A aplicação funciona completamente sem auth (portfólio/alertas livres por ora).
 * Auth real (Supabase Auth) será implementado em sprint futuro, quando o usuário autorizar.
 */
export const AuthProvider = ({ children }) => {
  return (
    <AuthContext.Provider value={{
      user: null,
      isAuthenticated: false,
      isLoadingAuth: false,
      isLoadingPublicSettings: false,
      authError: null,
      appPublicSettings: null,
      logout: () => {},
      navigateToLogin: () => {},
      checkAppState: () => {},
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
