import React, { useState, useEffect } from "react";
import Login from "./components/Login";
import Register from "./components/Register";
import FileManager from "./components/FileManager";
import { ThemeProvider } from "./context/ThemeContext";
import authService from "./services/authService";

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState("login");

  useEffect(() => {
    const user = authService.getCurrentUser();
    if (user) {
      setCurrentUser(user);
    }
  }, []);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
  };

  const handleRegisterSuccess = (user) => {
    setCurrentUser(user);
    setCurrentView("login");
  };

  const handleLogout = () => {
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
          <FileManager user={currentUser} onLogout={handleLogout} />
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
