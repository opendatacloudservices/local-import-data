import * as dotenv from 'dotenv';
import * as path from 'path';
import {Client} from 'pg';
import {Ckan} from './harvester/ckan';
import {Harvester} from './harvester/index';

// get environmental variables
dotenv.config({path: path.join(__dirname, '../.env')});

import {api, catchAll, startTransaction, logError} from 'local-microservice';

// connect to postgres (via env vars params)
const client = new Client({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: parseInt(process.env.PGPORT || '5432'),
});
client.connect();

// harvester setup
const harvesters: {[key: string]: Harvester} = {};
harvesters.ckan = new Ckan(client);

// TODO: tests
// TODO: import all
// TODO: create databases
// TODO: clear databases

/**
 * @swagger
 *
 * /import/{harvester}:
 *   get:
 *     operationId: getImport
 *     description: Check for new data to import and then run
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: harvester
 *         description: name of the harvester to check.
 *         in: path
 *         required: true
 *         schema:
 *           type: number
 *     responses:
 *       500:
 *         description: error
 *       200:
 *         description: Check initiated
 */
api.get('/import/:harvester', (req, res) => {
  const trans = startTransaction({name: '/import', type: 'get'});

  if (!(req.params.harvester in harvesters)) {
    logError(`harvester not found: ${req.params.harvester}`);
    res.status(404).json({message: 'harvester type does not exist'});
  } else {
    harvesters[req.params.harvester]
      .check()
      .then(result => {
        if (!result) {
          res.status(200).json({message: 'Nothing to import.'});
        } else {
          res.status(200).json({
            message:
              'Data imported or import already in progress (at the end of the import system will automatically check for new imports).',
          });
        }
        trans.end('success');
      })
      .catch(err => {
        console.log(err);
        logError(err);
        trans.end('error');
        res.status(500).json({message: err});
      });
  }
});

catchAll();
