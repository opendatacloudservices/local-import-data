const dotenv = require('dotenv');
const pg = require('pg');
const {
  masterTableExist: ckanMasterTableExist,
  initMasterTable: ckanInitMasterTable,
  tablesExist: ckanTablesExist,
  initTables: ckanInitTables,
  definition_tables: ckanDefinition_tables,
} = require('../node_modules/local-ckan-harvester/build/postgres/index');

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

/*---------- HARVESTER TESTS ----------*/

// CKAN is used to also test harvester class functions,
// subsequent harvesters do not require class function tests

/*----- CKAN -----*/

// connect to postgres (via env vars params)
const ckanClient = new pg.Client({
  user: process.env.PGCKANUSER,
  host: process.env.PGCKANHOST,
  database: process.env.PGCKANDATABASETEST,
  password: process.env.PGCKANPASSWORD,
  port: process.env.PGCKANPORT,
});

ckanClient.connect();

test('CKAN: check if test database is available', async () => {
  await ckanClient.query('SELECT version() AS v;').then((result) => {
    expect(result).toHaveProperty('rows');
    expect(result.rows.length).toBeGreaterThan(0);
    expect(typeof result.rows[0].v).toBe('string');
  });

  // reset demo database
  await ckanClient.query(`SELECT 
      tablename
    FROM
      pg_tables
    WHERE
      schemaname = 'public';
  `).then((result) => {
    return Promise.all(result.rows.map((row) => {
      return ckanClient.query(`DROP TABLE IF EXISTS ${row.tablename} CASCADE;`);
    }));
  });

  await ckanMasterTableExist(ckanClient)
    .then((result) => {
      if (!result) {
        return ckanInitMasterTable(ckanClient);
      }
    });

  await ckanMasterTableExist(ckanClient)
    .then((result) => {
      expect(result).toBe(true);
    });

  await ckanTablesExist(ckanClient, 'govdata', ckanDefinition_tables)
    .then((result) => {
      if (!result) {
        return ckanInitTables(ckanClient, 'govdata', 'ckan.govdata.de/api/3', 3, null);
      }
      return Promise.resolve();
    });

  await ckanTablesExist(ckanClient, 'govdata', ckanDefinition_tables)
    .then((result) => {
      expect(result).toBe(true);
    });

  // add some demo data
  await ckanClient.query(`INSERT INTO govdata_packages (id, title, metadata_modified, metadata_created, license_title, author, maintainer, ckan_status) VALUES (1, 'title', '2020-01-01 00:00:00', '2020-01-01 00:00:00', 'license_title', 'author', 'maintainer', 'new')`);
  await ckanClient.query(`INSERT INTO govdata_groups (id, title) VALUES (1, 'title')`);
  await ckanClient.query(`INSERT INTO govdata_tags (id, display_name) VALUES (1, 'title')`);
  await ckanClient.query(`INSERT INTO govdata_resources (id, name, format, url, license, size) VALUES (1, 'name', 'format', 'url', 'license', 500)`);
  await ckanClient.query(`INSERT INTO govdata_ref_groups_packages (package_id, group_id) VALUES (1, 1)`);
  await ckanClient.query(`INSERT INTO govdata_ref_tags_packages (package_id, tag_id) VALUES (1, 1)`);
  await ckanClient.query(`INSERT INTO govdata_ref_resources_packages (package_id, resource_id) VALUES (1, 1)`);
});



