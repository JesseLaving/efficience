/* Initialize Vercel Postgres database with users and spaces tables.
   Run with: node scripts/init-db.js
*/
import { sql } from '@vercel/postgres';

async function initDb() {
  try {
    console.log('Creating users table...');
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        google_id VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    console.log('Creating spaces table...');
    await sql`
      CREATE TABLE IF NOT EXISTS spaces (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    console.log('Creating space_data table...');
    await sql`
      CREATE TABLE IF NOT EXISTS space_data (
        space_id INTEGER PRIMARY KEY REFERENCES spaces(id) ON DELETE CASCADE,
        data JSONB NOT NULL DEFAULT '{}',
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    console.log('Creating indexes...');
    await sql`CREATE INDEX IF NOT EXISTS idx_spaces_user_id ON spaces(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)`;

    console.log('✅ Database initialized successfully');
    process.exit(0);
  } catch (e) {
    console.error('❌ Database init error:', e);
    process.exit(1);
  }
}

initDb();
