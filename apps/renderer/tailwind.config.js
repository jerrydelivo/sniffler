module.exports = {
  content: [
    "./index.html",
    "./index.js",
    "./dist/**/*.{html,js}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        xs: "475px",
      },
      spacing: {
        18: "4.5rem",
        88: "22rem",
      },
      maxWidth: {
        xs: "20rem",
      },
    },
  },
  plugins: [],
};
