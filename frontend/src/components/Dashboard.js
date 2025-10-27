import React, { useState } from "react";
import authService from "../services/authService";

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
      const data = await authService.getProfile();
      setProfileData(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-800">
                Cygnus Dashboard
              </h1>
            </div>
            <div className="flex items-center">
              <button
                onClick={handleLogout}
                className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">
              Welcome, {user.username}!
            </h2>

            <div className="space-y-4">
              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  User Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-600 font-medium">Username:</p>
                    <p className="text-gray-800">{user.username}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 font-medium">Email:</p>
                    <p className="text-gray-800">{user.email}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 font-medium">User ID:</p>
                    <p className="text-gray-800">{user.id}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 font-medium">
                      Account Created:
                    </p>
                    <p className="text-gray-800">
                      {user.created_at
                        ? new Date(user.created_at).toLocaleDateString()
                        : "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  Dashboard
                </h3>
                <p className="text-gray-600 mb-4">
                  You have successfully logged in to the Cygnus Authentication
                  System.
                </p>

                {/* Test Protected Endpoint Button */}
                <div className="mt-4">
                  <button
                    onClick={handleGetProfile}
                    disabled={loading}
                    className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-blue-300"
                  >
                    {loading
                      ? "Loading..."
                      : "Test Protected Endpoint (Get Profile)"}
                  </button>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                    <p className="font-medium">Error:</p>
                    <p>{error}</p>
                  </div>
                )}

                {/* Profile Data from Protected Endpoint */}
                {profileData && (
                  <div className="mt-4 p-4 bg-green-100 border border-green-400 rounded">
                    <h4 className="font-semibold text-green-800 mb-2">
                      ✓ Protected Endpoint Response:
                    </h4>
                    <pre className="text-sm text-green-900 overflow-auto">
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
