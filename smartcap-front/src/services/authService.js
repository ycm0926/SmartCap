// src/services/authService.js
// const API_URL = '/api/auth';
const MY_URL = 'http://localhost:8080';
const API_URL = '/api/auth';

const authService = {
  login: async (loginId, password, rememberMe = false) => {
    try {
      const response = await fetch(`${MY_URL+API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ loginId, password, remember: rememberMe }),
        credentials: 'include', // Important for cookies
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Login failed');
      }

      const data = await response.text();
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }
};

export default authService;

