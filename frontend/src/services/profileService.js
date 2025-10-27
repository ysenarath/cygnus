import config from "../config/config";
import authService from "./authService";

const API_URL = `${config.backendUrl}/api/auth`;

const profileService = {
  /**
   * Get user profile from API
   * @returns {Promise<Object>} User profile data
   */
  async getProfile() {
    try {
      const response = await authService.authenticatedFetch(
        `${API_URL}/profile`
      );
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

export default profileService;
