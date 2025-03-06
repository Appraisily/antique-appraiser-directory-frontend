/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#f8fafc',
        foreground: '#1e293b',
        'muted-foreground': '#64748b',
        primary: '#0284c7',
        'primary-foreground': '#ffffff',
        secondary: '#7c3aed',
        'secondary-foreground': '#ffffff',
        accent: '#38bdf8',
        'accent-foreground': '#0c4a6e',
        border: '#e2e8f0',
        input: '#e2e8f0',
        ring: '#0284c7'
      },
      borderRadius: {
        lg: '0.625rem',
        xl: '1rem',
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: '65ch',
            color: '#334155',
            p: {
              lineHeight: '1.75',
            },
            h1: {
              fontWeight: '700',
            },
            h2: {
              fontWeight: '600',
            },
          },
        },
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      animation: {
        'fadeIn': 'fadeIn 0.3s ease-in-out',
        'fadeInUp': 'fadeInUp 0.5s ease-out',
        'float': 'float 4s ease-in-out infinite',
      },
      container: {
        center: true,
        padding: '1.5rem',
        screens: {
          'sm': '640px',
          'md': '768px',
          'lg': '1024px',
          'xl': '1280px',
          '2xl': '1440px',
        },
      },
    },
  },
  plugins: [],
};
