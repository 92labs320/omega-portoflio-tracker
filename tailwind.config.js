/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: '#000000',
        card: '#12121C',
        accent: '#00D964',
        loss: '#FF4444',
        'text-primary': '#FFFFFF',
        'text-secondary': 'rgba(255,255,255,0.4)',
      },
    },
  },
  plugins: [],
};
