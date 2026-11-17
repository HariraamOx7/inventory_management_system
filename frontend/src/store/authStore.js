import { create } from 'zustand';
import api from '../services/api';

export const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('user')) || null,
  isAuthenticated: !!localStorage.getItem('token'),
  loading: false,
  error: null,

  setAuth: (user, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, isAuthenticated: true, error: null });
  },

  login: async (username, password) => {
    set({ loading: true, error: null });
    try {
      const response = await api.post('/auth/login', { username, password });
      if (response.data.success) {
        const { user, token } = response.data;
        get().setAuth(user, token);
        set({ loading: false });
        return { success: true };
      } else {
        set({ loading: false, error: response.data.message || 'Login failed' });
        return { success: false, message: response.data.message };
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Unable to connect to server. Please try again.';
      set({ loading: false, error: message });
      return { success: false, message };
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, isAuthenticated: false, error: null });
  },

  changePassword: async (currentPassword, newPassword, confirmPassword) => {
    try {
      const response = await api.put('/auth/change-password', {
        currentPassword,
        newPassword,
        confirmPassword
      });
      return response.data;
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to update password';
      throw new Error(message);
    }
  },

  clearError: () => set({ error: null })
}));