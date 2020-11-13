const dotenv = require('dotenv');
const pg = require('pg');
const { forEachChild } = require('typescript');

const {
  tablesExist,
  initTables,
  resetTables,
  dropTables,
} = require('../build/postgres/index');


// get environmental variables
dotenv.config();

// connect to postgres (via env vars params)
const client = new pg.Client({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASETEST,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
});

client.connect();

test('check if test database is available', async () => {
  await client.query('SELECT version() AS v;').then((result) => {
    expect(result).toHaveProperty('rows');
    expect(result.rows.length).toBeGreaterThan(0);
    expect(typeof result.rows[0].v).toBe('string');
  });

  // reset demo database
  await client.query(`SELECT 
      tablename
    FROM
      pg_tables
    WHERE
      schemaname = 'public';
  `).then((result) => {
    return Promise.all(result.rows.map((row) => {
      return client.query(`DROP TABLE IF EXISTS ${row.tablename} CASCADE;`);
    }));
  });

  await client.query(`SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';`)
    .then((result) => {
      expect(result).toHaveProperty('rows');
      expect(parseInt(result.rows[0].count)).toEqual(0);
    });
});

test('masterTableExist:false', async () => {
   await tablesExist(client)
     .then((result) => {
       expect(result).toBe(false);
     });
});

test('initMasterTable', async () => {
  await initTables(client).then(() => client.query(`SELECT 
      COUNT(*) AS count
    FROM
      pg_tables
    WHERE
      schemaname = 'public' AND
      (tablename = 'datasets' OR tablename = 'taxonomies' OR tablename = 'files');`)
  )
  .then((result) => {
    expect(result).toHaveProperty('rows');
    expect(parseInt(result.rows[0].count)).toBe(3);
  });
});

test('masterTableExist:true', async () => {
  await tablesExist(client)
    .then((result) => {
      expect(result).toBe(true);
    });
});

test('masterTableReset', async () => {
  await resetTables(client);
  await Promise.all(['datasets','files','taxonomies'].map((table) => client.query(`SELECT COUNT(*) AS c FROM ${table}`)))
    .then((results) => {
      results.forEach((result) => {
        expect(result).toHaveProperty('rows');
        expect(parseInt(result.rows[0].c)).toBe(0);
      });
    });
});

test('masterTableDrop', async () => {
  await dropTables(client);
  await client.query(`SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';`)
    .then((result) => {
      expect(result).toHaveProperty('rows');
      expect(parseInt(result.rows[0].count)).toEqual(0);
    });
});

// Run tests for all ckan portals in the master db (different test file)
