import config from "../config/config";

const API_URL = `${config.backendUrl}/api/auth`;

// Timer for automatic token refresh
let refreshTokenTimer = null;

const authService = {
  /**
   * Register a new user
   * @param {Object} userData - User registration data
   * @param {string} userData.username - Username
   * @param {string} userData.email - Email address
   * @param {string} userData.password - Password
   * @returns {Promise<Object>} Response data
   */
  async register(userData) {
    try {
      const response = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Registration failed");
      }

      return data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Login a user and store JWT tokens
   * @param {Object} credentials - User login credentials
   * @param {string} credentials.username - Username
   * @param {string} credentials.password - Password
   * @returns {Promise<Object>} Response data
   */
  async login(credentials) {
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      // Store tokens and user data
      if (data.access_token) {
        sessionStorage.setItem("access_token", data.access_token);
      }
      if (data.refresh_token) {
        localStorage.setItem("refresh_token", data.refresh_token);
      }
      if (data.user) {
        localStorage.setItem("user", JSON.stringify(data.user));
      }

      // Set up automatic token refresh (refresh 1 minute before expiration)
      this.scheduleTokenRefresh();

      return data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Logout the current user
   * @returns {Promise<void>}
   */
  async logout() {
    try {
      const token = this.getAccessToken();
      if (token) {
        // Call logout endpoint to blacklist token
        await fetch(`${API_URL}/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      // Clear all stored data
      sessionStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user");

      // Clear refresh timer
      if (refreshTokenTimer) {
        clearTimeout(refreshTokenTimer);
        refreshTokenTimer = null;
      }
    }
  },

  /**
   * Get the current access token
   * @returns {string|null} Access token or null
   */
  getAccessToken() {
    return sessionStorage.getItem("access_token");
  },

  /**
   * Get the current refresh token
   * @returns {string|null} Refresh token or null
   */
  getRefreshToken() {
    return localStorage.getItem("refresh_token");
  },

  /**
   * Refresh the access token using refresh token
   * @returns {Promise<string|null>} New access token or null
   */
  async refreshAccessToken() {
    try {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) {
        throw new Error("No refresh token available");
      }

      const response = await fetch(`${API_URL}/refresh`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${refreshToken}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Token refresh failed");
      }

      // Update access token
      if (data.access_token) {
        sessionStorage.setItem("access_token", data.access_token);

        // Schedule next refresh
        this.scheduleTokenRefresh();

        return data.access_token;
      }

      return null;
    } catch (error) {
      console.error("Token refresh error:", error);
      // If refresh fails, logout user
      await this.logout();
      return null;
    }
  },

  /**
   * Schedule automatic token refresh
   * Refreshes token 1 minute before expiration (14 minutes for 15-minute tokens)
   */
  scheduleTokenRefresh() {
    // Clear existing timer
    if (refreshTokenTimer) {
      clearTimeout(refreshTokenTimer);
    }

    // Refresh after 14 minutes (1 minute before 15-minute expiration)
    const refreshTime = 14 * 60 * 1000; // 14 minutes in milliseconds

    refreshTokenTimer = setTimeout(async () => {
      await this.refreshAccessToken();
    }, refreshTime);
  },

  /**
   * Make an authenticated API request
   * @param {string} url - API endpoint URL
   * @param {Object} options - Fetch options
   * @returns {Promise<Response>} Fetch response
   */
  async authenticatedFetch(url, options = {}) {
    let token = this.getAccessToken();

    // Add Authorization header
    const headers = {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    let response = await fetch(url, { ...options, headers });

    // If token expired, try to refresh and retry request
    if (response.status === 401) {
      const newToken = await this.refreshAccessToken();
      if (newToken) {
        headers["Authorization"] = `Bearer ${newToken}`;
        response = await fetch(url, { ...options, headers });
      }
    }

    return response;
  },

  /**
   * Get the current user from localStorage
   * @returns {Object|null} Current user or null
   */
  getCurrentUser() {
    const user = localStorage.getItem("user");
    return user ? JSON.parse(user) : null;
  },

  /**
   * Check if user is authenticated
   * @returns {boolean} True if user has valid tokens
   */
  isAuthenticated() {
    return !!(this.getAccessToken() && this.getRefreshToken());
  },

  /**
   * Get user profile from API
   * @returns {Promise<Object>} User profile data
   */
  async getProfile() {
    try {
      const response = await this.authenticatedFetch(`${API_URL}/profile`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch profile");
      }

      // Update stored user data
      if (data.user) {
        localStorage.setItem("user", JSON.stringify(data.user));
      }

      return data;
    } catch (error) {
      throw error;
    }
  },
};

export default authService;
