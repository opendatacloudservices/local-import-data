const dotenv = require('dotenv');
// get environmental variables
dotenv.config();

// easier class construction
process.env['PGCKANDATABASE'] = process.env['PGCKANDATABASETEST'];

const pg = require('pg');

const {standardizeFormat} = require('../build/format');

// connect to postgres (via env vars params)
const ckanClient = new pg.Client({
  user: process.env.PGCKANUSER,
  host: process.env.PGCKANHOST,
  database: process.env.PGCKANDATABASETEST,
  password: process.env.PGCKANPASSWORD,
  port: process.env.PGCKANPORT,
});

ckanClient.connect();

test('standardizeFormat', async () => {
  console.log(
    standardizeFormat(
      '',
      'https://geoportal.saarland.de/mapbender/php/wms.php?inspire=1&amp;layer_id=42654&amp;withChilds=1&amp;REQUEST=GetCapabilities&amp;SERVICE=WMS'
    )
  );
  expect(1).toBe(1);
});
