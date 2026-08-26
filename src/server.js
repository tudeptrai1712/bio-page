require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 3000;

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`=========================================`);
  console.log(`🚀 Bio Page server running on port ${PORT}`);
  console.log(`🌐 Public Bio Page: http://localhost:${PORT}`);
  console.log(`🔒 Admin Dashboard: http://localhost:${PORT}/login.html`);
  console.log(`=========================================`);
});
