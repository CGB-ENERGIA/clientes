import pg from 'pg'
const { Client } = pg

const client = new Client({
  user:     'postgres.ggptxlpyuojkgdxmtbwd',
  password: '4iB3523$2Bwkd7VX',
  host:     'aws-0-sa-east-1.pooler.supabase.com',
  port:     5432,
  database: 'postgres',
  ssl:      { rejectUnauthorized: false }
})

try {
  await client.connect()
  const r = await client.query('SELECT current_user, version()')
  console.log('CONECTADO:', r.rows[0])
} catch(e) {
  console.error('ERRO:', e.message)
} finally {
  await client.end()
}
