import type { Config } from 'tailwindcss'

const config: Config = {
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                black: '#0a0a0a',
                cream: '#f4f1eb',
                gold: {
                    DEFAULT: '#d4a843',
                    light: '#f0c96a',
                    dim: '#8a6e2a',
                },
                surface: {
                    DEFAULT: '#141414',
                    2: '#1c1c1c',
                    3: '#252525',
                },
            },
            fontFamily: {
                display: ['Bebas Neue', 'sans-serif'],
                body: ['DM Sans', 'sans-serif'],
                mono: ['DM Mono', 'monospace'],
            },
        },
    },
    plugins: [],
}

export default config