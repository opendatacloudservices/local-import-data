import * as dotenv from 'dotenv';
import * as path from 'path';
import {Client} from 'pg';
// import fetch from 'node-fetch';
import {Ckan} from './harvester/ckan';
import {Harvester} from './harvester/index';
// import * as pm2 from 'local-pm2-config';

// get environmental variables
dotenv.config({path: path.join(__dirname, '../.env')});

import {api, catchAll, startTransaction} from 'local-microservice';

// connect to postgres (via env vars params)
const client = new Client({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: parseInt(process.env.PGPORT || '5432'),
});
client.connect();

// number of parallel processes
// let processCount = 1;
// pm2.apps.forEach(app => {
//   if (app.name === 'local-import-data') {
//     processCount = app.max;
//   }
// });

// harvester setup
const harvesters: Harvester[] = [];
harvesters.push(new Ckan());

const inProgress = false;

/**
 * @swagger
 *
 * /import/{harvester}/{instance}/{dataset}:
 *   get:
 *     operationId: getImport
 *     description: Import a dataset through one of the harvesters
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: harvester
 *         description: name of the harvester class.
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: instance
 *         description: id of the dataset's instance.
 *         in: path
 *         required: true
 *         schema:
 *           type: number
 *       - name: dataset
 *         description: id of the dataset to import.
 *         in: path
 *         required: true
 *         schema:
 *           type: number
 *     responses:
 *       500:
 *         description: error
 *       200:
 *         description: Import completed
 */
api.get('/import/:harvester/:instance/:dataset', (req, res) => {
  const trans = startTransaction({name: '/import', type: 'get'});
  res.status(200).json({message: 'Import completed'});
  trans.end('success');
});

/**
 * @swagger
 *
 * /check:
 *   get:
 *     operationId: getCheck
 *     description: Check for new data to import
 *     produces:
 *       - application/json
 *     parameters:
 *     responses:
 *       500:
 *         description: error
 *       200:
 *         description: Check initiated
 */
api.get('/check', (req, res) => {
  const trans = startTransaction({name: '/check', type: 'get'});
  harvesters[0].check().then(result => {
    console.log('check', result);
  });

  if (inProgress) {
    res
      .status(200)
      .json({message: 'Check already running, will restart after completion.'});
  } else {
    // reinitiate import
    res.status(200).json({message: 'Check initiated'});
  }
  trans.end('success');
});

catchAll();
