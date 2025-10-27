/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  darkMode: 'class', // Enable dark mode with class strategy
  theme: {
    extend: {
      colors: {
        // Light theme colors
        light: {
          bg: '#ffffff',
          surface: '#f8f9fa',
          text: '#1a202c',
          'text-secondary': '#4a5568',
          border: '#e2e8f0',
          primary: '#3b82f6',
          'primary-hover': '#2563eb',
        },
        // Dark theme colors
        dark: {
          bg: '#1a202c',
          surface: '#2d3748',
          text: '#f7fafc',
          'text-secondary': '#cbd5e0',
          border: '#4a5568',
          primary: '#60a5fa',
          'primary-hover': '#3b82f6',
        },
      },
    },
  },
  plugins: [],
};
