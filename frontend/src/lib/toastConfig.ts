// frontend/src/lib/toastConfig.ts

/**
 * Toast notification configuration for scoreboard aesthetic
 */

import toast, { type ToastOptions } from 'react-hot-toast';

/**
 * Default toast options matching scoreboard theme
 */
export const defaultToastOptions: ToastOptions = {
  duration: 4000,
  position: 'top-right',
  style: {
    background: '#0A1128',
    color: '#F8F9FA',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    fontFamily: 'var(--font-body)',
  },
};

/**
 * Show error toast with LED red accent
 */
export function toastError(message: string): void {
  toast.error(message, {
    ...defaultToastOptions,
    style: {
      ...defaultToastOptions.style,
      borderColor: '#FF3131',
    },
    iconTheme: {
      primary: '#FF3131',
      secondary: '#0A1128',
    },
  });
}
