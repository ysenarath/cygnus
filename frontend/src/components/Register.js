import React, { useState } from "react";
import authService from "../services/authService";

function Register({ onRegisterSuccess, onSwitchToLogin }) {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const { confirmPassword, ...userData } = formData;
      const response = await authService.register(userData);
      onRegisterSuccess(response.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-light-surface dark:bg-dark-bg">
      <div className="bg-light-bg dark:bg-dark-surface p-8 rounded-lg shadow-md w-96 border border-light-border dark:border-dark-border">
        <h2 className="text-2xl font-bold mb-6 text-center text-light-text dark:text-dark-text">
          Register
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="username"
              className="block text-light-text dark:text-dark-text font-medium mb-2"
            >
              Username
            </label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-light-border dark:border-dark-border rounded-md bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-light-primary dark:focus:ring-dark-primary"
              required
            />
          </div>

          <div className="mb-4">
            <label
              htmlFor="email"
              className="block text-light-text dark:text-dark-text font-medium mb-2"
            >
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-light-border dark:border-dark-border rounded-md bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-light-primary dark:focus:ring-dark-primary"
              required
            />
          </div>

          <div className="mb-4">
            <label
              htmlFor="password"
              className="block text-light-text dark:text-dark-text font-medium mb-2"
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-light-border dark:border-dark-border rounded-md bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-light-primary dark:focus:ring-dark-primary"
              required
            />
          </div>

          <div className="mb-6">
            <label
              htmlFor="confirmPassword"
              className="block text-light-text dark:text-dark-text font-medium mb-2"
            >
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-light-border dark:border-dark-border rounded-md bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-light-primary dark:focus:ring-dark-primary"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-light-primary dark:bg-dark-primary text-white py-2 px-4 rounded-md hover:bg-light-primary-hover dark:hover:bg-dark-primary-hover focus:outline-none focus:ring-2 focus:ring-light-primary dark:focus:ring-dark-primary disabled:opacity-50 transition-colors"
          >
            {loading ? "Registering..." : "Register"}
          </button>
        </form>

        <p className="mt-4 text-center text-light-text-secondary dark:text-dark-text-secondary">
          Already have an account?{" "}
          <button
            onClick={onSwitchToLogin}
            className="text-light-primary dark:text-dark-primary hover:text-light-primary-hover dark:hover:text-dark-primary-hover font-medium transition-colors"
          >
            Login
          </button>
        </p>
      </div>
    </div>
  );
}

export default Register;
