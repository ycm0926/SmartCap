// src/services/authService.js
const MY_URL = import.meta.env.VITE_API_BASE_URL;
const API_URL = '/api/auth';

const authService = {
  login: async (loginId, password, rememberMe = false) => {
    try {
      const response = await fetch(`${MY_URL+API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          loginId, 
          password, 
          rememberMe: rememberMe // 필드명이 DTO와 일치해야 함
        }),
        credentials: 'include',
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