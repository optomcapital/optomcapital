/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        surface: '#FFFFFF',
        bg: '#F7F7F5',
        border: {
          DEFAULT: '#E5E5E3',
          subtle: '#E9E9E7',
          input: '#D9D9D6',
          divider: '#EFEFED',
        },
        text: {
          primary: '#1A1A1A',
          secondary: '#6F6F6F',
          muted: '#AFAFAF',
        },
        accent: {
          DEFAULT: '#2F6FED',
        },
        danger: '#E5484D',
        success: '#30A46C',
        warning: '#F76B15',
      },
      boxShadow: {
        panel: '0 1px 3px rgba(0,0,0,0.06)',
      },
      borderRadius: {
        panel: '8px',
      },
    },
  },
  plugins: [],
}
