import React, { useState, useEffect } from 'react';
import Login from './Login';
import { Fingerprint } from 'lucide-react';

// IMPORTING YOUR DASHBOARD
import AdminDashboard from './AdminDashboard';
import TeacherDashboard from './TeacherDashboard';
import StudentDashboard from './StudentDashboard';

const App = () => {
  // 1. CHECK MEMORY ON LOAD FIRST
  const initialLoginState = localStorage.getItem('isLoggedIn') === 'true';
  const [isLoggedIn, setIsLoggedIn] = useState(initialLoginState);
  const [userRole, setUserRole] = useState(() => {
    return localStorage.getItem('userRole') || '';
  });

  // CHECK THE SAVED THEME
  const isDark = localStorage.getItem('appTheme') !== 'light';

  // 2. ONLY SHOW INTRO IF NOT LOGGED IN
  const [showIntro, setShowIntro] = useState(!initialLoginState);
  const [fadeIntro, setFadeIntro] = useState(false);

  const handleLoginSuccess = (role) => {
    setUserRole(role);
    setIsLoggedIn(true);
    setShowIntro(false);
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('userRole', role);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserRole('');
    setShowIntro(true);
    setFadeIntro(false);
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userRole');
    localStorage.removeItem('adminActiveView');
  };

  // --- THE TRAFFIC COP ---
  const renderDashboard = () => {
    switch (Number(userRole)) {
      case 1:
        return <AdminDashboard onLogout={handleLogout} />;
      case 2:
        return <TeacherDashboard onLogout={handleLogout} />;
      case 3:
        return <StudentDashboard onLogout={handleLogout} />;
      default:
        return (
          <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
            <h1 className="text-red-500 font-bold mb-4">Error: Unknown User Role</h1>
            <button onClick={handleLogout} className="underline text-cyan-400">Return to Login</button>
          </div>
        );
    }
  };
  
  if (isLoggedIn) {
    return renderDashboard();
  }

  return (
    <div className={`relative w-full min-h-screen ${isDark ? 'bg-black' : 'bg-white'} overflow-hidden font-sans`}>
      <Login onLoginSuccess={handleLoginSuccess} />
    </div>
  );
};

export default App;