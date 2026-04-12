import { Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { ErrorBoundary } from '@/lib/errorBoundary';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

// Skeleton de página — só cobre a área de conteúdo, sidebar permanece visível
const PageLoadingFallback = () => (
  <div style={{ padding: '24px', animation: 'fade-in 0.15s ease' }}>
    {/* Linha de título */}
    <div style={{
      height: 18, width: '35%', borderRadius: 6, marginBottom: 20,
      background: 'linear-gradient(90deg, #0d1421 25%, #162032 50%, #0d1421 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
    }} />
    {/* Cards */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{
          height: 88, borderRadius: 12,
          background: 'linear-gradient(90deg, #0d1421 25%, #162032 50%, #0d1421 75%)',
          backgroundSize: '200% 100%',
          animation: `shimmer 1.5s infinite ${i * 0.1}s`,
          border: '1px solid #162032',
        }} />
      ))}
    </div>
    {/* Bloco de conteúdo */}
    <div style={{
      height: 280, borderRadius: 12,
      background: 'linear-gradient(90deg, #0d1421 25%, #162032 50%, #0d1421 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite 0.2s',
      border: '1px solid #162032',
    }} />
  </div>
);

const LayoutWrapper = ({ children, currentPageName }) => {
  const content = (
    <Suspense fallback={<PageLoadingFallback />}>
      {children}
    </Suspense>
  );
  return Layout
    ? <Layout currentPageName={currentPageName}>{content}</Layout>
    : <>{content}</>;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app — Suspense fica dentro de LayoutWrapper (sidebar nunca pisca)
  return (
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
