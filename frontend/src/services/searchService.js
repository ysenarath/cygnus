import config from "../config/config";
import authService from "./authService";

const API_URL = `${config.backendUrl}/api/files`;

class SearchService {
  /**
   * Search documents
   * @param {string} query - Search query text
   * @param {number} nResults - Number of results to return
   * @returns {Promise} - Search results
   */
  async searchDocuments(query, nResults = 10) {
    const response = await authService.authenticatedFetch(`${API_URL}/search`, {
      method: "POST",
      body: JSON.stringify({ query, n_results: nResults }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Search failed");
    }

    return response.json();
  }

  /**
   * Get indexing statistics
   * @returns {Promise} - Indexing stats
   */
  async getStats() {
    const response = await authService.authenticatedFetch(`${API_URL}/stats`, {
      method: "GET",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to get stats");
    }

    return response.json();
  }

  /**
   * Get indexing status for a file
   * @param {number} nodeId - Node ID
   * @returns {Promise} - Indexing status
   */
  async getIndexingStatus(nodeId) {
    const response = await authService.authenticatedFetch(`${API_URL}/${nodeId}/indexing-status`, {
      method: "GET",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to get indexing status");
    }

    return response.json();
  }
}

export default new SearchService();
