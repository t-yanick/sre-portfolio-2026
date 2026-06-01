const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Connect to Postgres using env vars — Docker Compose will inject these
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'lab03',
});

// Create the table on startup (idempotent)
async function init() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS visits (
        id SERIAL PRIMARY KEY,
        hostname TEXT NOT NULL,
        timestamp TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('Database initialized.');
  } catch (err) {
    console.error('Database init failed:', err.message);
  }
}

// Record a visit and return the count
app.get('/', async (req, res) => {
  try {
    const hostname = require('os').hostname();
    await pool.query('INSERT INTO visits (hostname) VALUES ($1)', [hostname]);
    const result = await pool.query('SELECT COUNT(*) FROM visits');
    res.json({
      message: 'Hello from the multi-container app!',
      api_hostname: hostname,
      total_visits: parseInt(result.rows[0].count, 10),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
  init();
});
