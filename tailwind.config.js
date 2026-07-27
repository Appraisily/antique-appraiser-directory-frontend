/** @type {import('tailwindcss').Config} */
/*
 * Heritage editorial theme.
 * NOTE: the `blue` scale is intentionally remapped to antique brass and the
 * `gray`/`slate` scales to warm stone neutrals. Components keep their existing
 * class names (text-blue-700, bg-gray-50, …) but render in the heritage
 * palette. Use `primary` for new branded elements.
 */
const brass = {
  50: '#fbf8f0',
  100: '#f5eeda',
  200: '#e9dab4',
  300: '#dcc188',
  400: '#caa45b',
  500: '#b58a3a',
  600: '#9a6b1f',
  700: '#7c551b',
  800: '#5f4115',
  900: '#452f0f',
  950: '#2c1f0a',
};

const warmGray = {
  50: '#faf9f6',
  100: '#f3f1ec',
  200: '#e6e2d8',
  300: '#d2ccbd',
  400: '#a79e8b',
  500: '#857b68',
  600: '#6a6252',
  700: '#554e42',
  800: '#3d3830',
  900: '#292521',
  950: '#171411',
};

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#faf8f3',
        foreground: '#1c1917',
        'muted-foreground': '#6a6252',
        primary: '#9a6b1f',
        'primary-foreground': '#fffdf7',
        secondary: '#1d4a38',
        'secondary-foreground': '#ffffff',
        accent: '#caa45b',
        'accent-foreground': '#2c1f0a',
        border: '#e6e2d8',
        input: '#e6e2d8',
        ring: '#9a6b1f',
        blue: brass,
        sky: brass,
        gray: warmGray,
        slate: warmGray,
      },
      fontFamily: {
        serif: ['Fraunces', 'Georgia', 'Times New Roman', 'serif'],
      },
      borderRadius: {
        lg: '0.625rem',
        xl: '1rem',
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: '65ch',
            color: '#3d3830',
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
        'sm': '0 1px 2px 0 rgba(41, 37, 33, 0.05)',
        DEFAULT: '0 1px 3px 0 rgba(41, 37, 33, 0.1), 0 1px 2px 0 rgba(41, 37, 33, 0.06)',
        'md': '0 4px 6px -1px rgba(41, 37, 33, 0.1), 0 2px 4px -1px rgba(41, 37, 33, 0.06)',
        'lg': '0 10px 15px -3px rgba(41, 37, 33, 0.1), 0 4px 6px -2px rgba(41, 37, 33, 0.05)',
        'xl': '0 20px 25px -5px rgba(41, 37, 33, 0.1), 0 10px 10px -5px rgba(41, 37, 33, 0.04)',
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
