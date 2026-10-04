import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, LazyMotion, MotionConfig } from 'framer-motion';

import { UserProvider, useUser } from './context/UserContext';
import { LeenkitProvider } from './context/LeenkitContext';
import { LocationProvider } from './context/LocationContext';
import { ToastProvider } from './components/common/Toast';

import Navbar from './components/layout/Navbar';
import MobileNav from './components/layout/MobileNav';
import Footer from './components/layout/Footer';
import ScrollToTop from './components/common/ScrollToTop';
import ErrorBoundary from './components/common/ErrorBoundary';
import Loader from './components/common/Loader';
import InstallPrompt from './components/common/InstallPrompt';

const loadMotionFeatures = () => import('./lib/motionFeatures').then((mod) => mod.default);

// Not needed for first paint.
const AuthModal = lazy(() => import('./components/auth/AuthModal'));
const LegalAcceptanceGate = lazy(() => import('./components/auth/LegalAcceptanceGate'));

// Route-level Code Splitting / Lazy Loading
const Home = lazy(() => import('./pages/Home'));
const Explore = lazy(() => import('./pages/Explore'));
const HangoutDetails = lazy(() => import('./pages/HangoutDetails'));
const HangoutSpace = lazy(() => import('./pages/HangoutSpace'));
const CreateHangout = lazy(() => import('./pages/CreateHangout'));
const MyHangouts = lazy(() => import('./pages/MyHangouts'));
const Profile = lazy(() => import('./pages/Profile'));
const EditProfile = lazy(() => import('./pages/EditProfile'));
const Login = lazy(() => import('./pages/Login'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Safety = lazy(() => import('./pages/Safety'));
const Faq = lazy(() => import('./pages/Faq'));
const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Activity = lazy(() => import('./pages/Activity'));
const NotFound = lazy(() => import('./pages/NotFound'));
const PayoutSettings = lazy(() => import('./pages/PayoutSettings'));
const Admin = lazy(() => import('./pages/Admin'));

function PageFallback() {
  return <Loader label="Loading" className="min-h-[60vh] p-8" />;
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <ErrorBoundary key={location.pathname}>
    <AnimatePresence mode="wait">
      <Suspense fallback={<PageFallback />}>
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Home />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="/hangout/:id" element={<HangoutDetails />} />
          <Route path="/hangout/:id/space" element={<HangoutSpace />} />
          <Route path="/create" element={<CreateHangout />} />
          <Route path="/my-hangouts" element={<MyHangouts />} />
          <Route path="/your-hangouts" element={<MyHangouts />} />
          <Route path="/profile/:username" element={<Profile />} />
          <Route path="/edit-profile" element={<EditProfile />} />
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/safety" element={<Safety />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/payouts" element={<PayoutSettings />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </AnimatePresence>
    </ErrorBoundary>
  );
}

function SuspendedBanner() {
  const { currentUser } = useUser();
  if (!currentUser?.suspendedAt) return null;
  return (
    <div role="alert" className="bg-rose-700 text-white text-sm px-4 py-2.5 text-center">
      Your account is suspended, so you can't host, join or post right now.
      {currentUser.suspensionReason ? ` Reason: ${currentUser.suspensionReason}.` : ''} Contact LEENKIT support to appeal.
    </div>
  );
}

function GlobalAuthModal() {
  const { isAuthModalOpen, closeAuthModal, authModalInitialView } = useUser();
  if (!isAuthModalOpen) return null;
  return (
    <Suspense fallback={null}>
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
        initialView={authModalInitialView}
      />
    </Suspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
    <ToastProvider>
      <UserProvider>
        <LocationProvider>
          <LeenkitProvider>
            <LazyMotion features={loadMotionFeatures} strict>
            <MotionConfig reducedMotion="user">
              <BrowserRouter>
                <ScrollToTop />
                <div className="min-h-screen flex flex-col justify-between bg-[#FFF8EE] font-sans selection:bg-[#FF6B2C] selection:text-white">
                  <div>
                    <SuspendedBanner />
                    <Navbar />
                    <main id="main">
                      <AnimatedRoutes />
                    </main>
                  </div>
                  <Footer />
                  <MobileNav />
                  <GlobalAuthModal />
                  <Suspense fallback={null}>
                    <LegalAcceptanceGate />
                  </Suspense>
                  <InstallPrompt />
                </div>
              </BrowserRouter>
            </MotionConfig>
            </LazyMotion>
          </LeenkitProvider>
        </LocationProvider>
      </UserProvider>
    </ToastProvider>
    </ErrorBoundary>
  );
}
