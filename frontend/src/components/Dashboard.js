import React, { useState } from "react";
import authService from "../services/authService";
import profileService from "../services/profileService";
import ThemeToggle from "./ThemeToggle";

function Dashboard({ user, onLogout }) {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogout = async () => {
    await authService.logout();
    onLogout();
  };

  const handleGetProfile = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await profileService.getProfile();
      setProfileData(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-light-surface dark:bg-dark-bg">
      <nav className="bg-light-bg dark:bg-dark-surface shadow-md border-b border-light-border dark:border-dark-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-light-text dark:text-dark-text">
                Cygnus Dashboard
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              {/* Profile Icon */}
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-light-primary to-light-primary-hover dark:from-dark-primary dark:to-dark-primary-hover rounded-full flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <span className="text-sm font-medium text-light-text dark:text-dark-text hidden sm:block">
                  {user.username}
                </span>
              </div>

              {/* Theme Toggle */}
              <ThemeToggle />

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="bg-red-500 dark:bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-600 dark:hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-light-bg dark:bg-dark-surface rounded-lg shadow-md p-6 border border-light-border dark:border-dark-border">
            <h2 className="text-2xl font-bold mb-4 text-light-text dark:text-dark-text">
              Welcome, {user.username}!
            </h2>

            <div className="space-y-4">
              <div className="border-b border-light-border dark:border-dark-border pb-4">
                <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-2">
                  User Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-light-text-secondary dark:text-dark-text-secondary font-medium">Username:</p>
                    <p className="text-light-text dark:text-dark-text">{user.username}</p>
                  </div>
                  <div>
                    <p className="text-light-text-secondary dark:text-dark-text-secondary font-medium">Email:</p>
                    <p className="text-light-text dark:text-dark-text">{user.email}</p>
                  </div>
                  <div>
                    <p className="text-light-text-secondary dark:text-dark-text-secondary font-medium">User ID:</p>
                    <p className="text-light-text dark:text-dark-text">{user.id}</p>
                  </div>
                  <div>
                    <p className="text-light-text-secondary dark:text-dark-text-secondary font-medium">
                      Account Created:
                    </p>
                    <p className="text-light-text dark:text-dark-text">
                      {user.created_at
                        ? new Date(user.created_at).toLocaleDateString()
                        : "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-2">
                  Dashboard
                </h3>
                <p className="text-light-text-secondary dark:text-dark-text-secondary mb-4">
                  You have successfully logged in to the Cygnus Authentication
                  System.
                </p>

                {/* Test Protected Endpoint Button */}
                <div className="mt-4">
                  <button
                    onClick={handleGetProfile}
                    disabled={loading}
                    className="bg-light-primary dark:bg-dark-primary text-white px-4 py-2 rounded-md hover:bg-light-primary-hover dark:hover:bg-dark-primary-hover focus:outline-none focus:ring-2 focus:ring-light-primary dark:focus:ring-dark-primary disabled:opacity-50 transition-colors"
                  >
                    {loading
                      ? "Loading..."
                      : "Test Protected Endpoint (Get Profile)"}
                  </button>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="mt-4 p-4 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 rounded">
                    <p className="font-medium">Error:</p>
                    <p>{error}</p>
                  </div>
                )}

                {/* Profile Data from Protected Endpoint */}
                {profileData && (
                  <div className="mt-4 p-4 bg-green-100 dark:bg-green-900 border border-green-400 dark:border-green-600 rounded">
                    <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">
                      ✓ Protected Endpoint Response:
                    </h4>
                    <pre className="text-sm text-green-900 dark:text-green-100 overflow-auto">
                      {JSON.stringify(profileData, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
