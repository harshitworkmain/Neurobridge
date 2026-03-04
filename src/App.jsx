import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './layouts/Layout';
import { PreferencesProvider, usePreferences } from './contexts/PreferencesContext';
import OnboardingFlow from './components/OnboardingFlow';
import ErrorBoundary from './components/ErrorBoundary';

import Home from './pages/Home';
import Screening from './pages/Screening';
import Therapy from './pages/Therapy';
import Progress from './pages/Progress';
import Community from './pages/Community';
import Clinician from './pages/Clinician';
import Consent from './pages/Consent';
import Reports from './pages/Reports';
import Appointments from './pages/Appointments';
import GameHub from './pages/GameHub';
import TherapyGoals from './pages/TherapyGoals';

function AppContent() {
  const { preferences, loaded, completeOnboarding } = usePreferences();

  if (!loaded) return null;

  return (
    <>
      {/* Onboarding overlay for new users */}
      {loaded && !preferences.onboarding_completed && (
        <OnboardingFlow onComplete={completeOnboarding} />
      )}

      <Layout>
        <Routes>
          <Route path="/" element={<ErrorBoundary name="Dashboard"><Home /></ErrorBoundary>} />
          <Route path="/screening" element={<ErrorBoundary name="AI Screening"><Screening /></ErrorBoundary>} />
          <Route path="/therapy" element={<ErrorBoundary name="Therapy Plan"><Therapy /></ErrorBoundary>} />
          <Route path="/progress" element={<ErrorBoundary name="Progress"><Progress /></ErrorBoundary>} />
          <Route path="/community" element={<ErrorBoundary name="Community"><Community /></ErrorBoundary>} />
          <Route path="/clinician" element={<ErrorBoundary name="Clinician Mode"><Clinician /></ErrorBoundary>} />
          <Route path="/consent" element={<ErrorBoundary name="Consent"><Consent /></ErrorBoundary>} />
          <Route path="/reports" element={<ErrorBoundary name="Reports"><Reports /></ErrorBoundary>} />
          <Route path="/appointments" element={<ErrorBoundary name="Appointments"><Appointments /></ErrorBoundary>} />
          <Route path="/games" element={<ErrorBoundary name="Games"><GameHub /></ErrorBoundary>} />
          <Route path="/goals" element={<ErrorBoundary name="Therapy Goals"><TherapyGoals /></ErrorBoundary>} />
        </Routes>
      </Layout>
    </>
  );
}

function App() {
  return (
    <Router>
      <PreferencesProvider>
        <AppContent />
      </PreferencesProvider>
    </Router>
  );
}

export default App;
