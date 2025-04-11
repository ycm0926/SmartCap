// src/services/authService.js
import axios from 'axios';

const authService = {
  login: async (loginId, password, rememberMe) => {
    try {
      const response = await axios.post('/api/auth/login', 
        { loginId, password, rememberMe },
        {
          baseURL: import.meta.env.VITE_API_BASE_URL,
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Login error details:', {
        status: error.response?.status,
        data: error.response?.data,
        headers: error.response?.headers
      });
      throw error;
    }
  }
};

export default authService;