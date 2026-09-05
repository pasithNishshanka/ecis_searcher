require('dotenv').config();

const app = require('./app');
const pool = require('./config/database');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await pool.query('SELECT 1');

    console.log('PostgreSQL connected successfully');

    app.listen(PORT, () => {
      console.log(`ECIS backend running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start backend');
    console.error(error.message);

    process.exit(1);
  }
}

startServer();