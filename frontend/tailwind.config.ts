import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          950: '#020617'
        }
      },
      boxShadow: {
        card: '0 12px 40px -16px rgba(15, 118, 230, 0.35)'
      }
    }
  },
  plugins: []
}

export default config

