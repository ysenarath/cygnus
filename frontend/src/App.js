import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login";
import Register from "./components/Register";
import FileManager from "./components/FileManager";
import Search from "./components/Search";
import { ThemeProvider } from "./context/ThemeContext";
import authService from "./services/authService";

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState("login");

  useEffect(() => {
    const user = authService.getCurrentUser();
    if (user && authService.isAuthenticated()) {
      setCurrentUser(user);
      // Reinitialize token refresh timer if user is already logged in
      authService.scheduleTokenRefresh();
    }
  }, []);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
  };

  const handleRegisterSuccess = (user) => {
    setCurrentUser(user);
    setCurrentView("login");
  };

  const handleLogout = async () => {
    await authService.logout();
    setCurrentUser(null);
    setCurrentView("login");
  };

  const switchToRegister = () => {
    setCurrentView("register");
  };

  const switchToLogin = () => {
    setCurrentView("login");
  };

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-light-bg dark:bg-dark-bg transition-colors duration-200">
        {currentUser ? (
          <Router>
            <Routes>
              <Route path="/" element={<Search user={currentUser} onLogout={handleLogout} />} />
              <Route path="/files" element={<FileManager user={currentUser} onLogout={handleLogout} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        ) : currentView === "register" ? (
          <Register
            onRegisterSuccess={handleRegisterSuccess}
            onSwitchToLogin={switchToLogin}
          />
        ) : (
          <Login
            onLoginSuccess={handleLoginSuccess}
            onSwitchToRegister={switchToRegister}
          />
        )}
      </div>
    </ThemeProvider>
  );
}

export default App;
