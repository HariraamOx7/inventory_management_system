import { create } from 'zustand';

export const useToastStore = create((set) => ({
  toast: null,
  showToast: (message, type = 'success') => {
    set({ toast: { message, type, id: Date.now() } });
  },
  hideToast: () => set({ toast: null })
}))