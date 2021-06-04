import * as dotenv from 'dotenv';
import * as path from 'path';
import {Client} from 'pg';
import {Ckan} from './harvester/ckan';
import {Harvester} from './harvester/index';
import {resetTables, duplicateByUrl} from './postgres/index';
import fetch from 'node-fetch';

// get environmental variables
dotenv.config({path: path.join(__dirname, '../.env')});

import {api, catchAll, port, simpleResponse} from 'local-microservice';
import {startTransaction, logError, addToken, localTokens} from 'local-logger';

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

/**
 * @swagger
 *
 * /master/reset:
 *   get:
 *     operationId: getMasterReset
 *     description: Reset the database structure
 *     produces:
 *       - application/json
 *     responses:
 *       500:
 *         description: error
 *       200:
 *         description: success
 */
api.get('/master/reset', (req, res) => {
  resetTables(client)
    .then(() => {
      return res.status(200).json({message: 'Tables reset'});
    })
    .catch(err => {
      logError(err);
      return res.status(500).json({message: err});
    });
});

/**
 * @swagger
 *
 * /master/duplicates:
 *   get:
 *     operationId: getMasterDuplicates
 *     description: Identify duplicates in database
 *     produces:
 *       - application/json
 *     responses:
 *       500:
 *         description: error
 *       200:
 *         description: success
 */
api.get('/master/duplicates', (req, res) => {
  duplicateByUrl(client)
    .then(() => {
      return res.status(200).json({message: 'Duplicates identified'});
    })
    .catch(err => {
      logError(err);
      return res.status(500).json({message: err});
    });
});

/**
 * @swagger
 *
 * /import/all:
 *   get:
 *     operationId: getImportAll
 *     description: initate import on all harvesters
 *     produces:
 *       - application/json
 *     responses:
 *       500:
 *         description: error
 *       200:
 *         description: success
 */
api.get('/import/all', (req, res) => {
  const trans = startTransaction({
    name: '/import/all',
    type: 'get',
    ...localTokens(res),
  });
  new Promise((resolve, reject) => {
    Promise.all(
      Object.keys(harvesters).map(key => {
        return fetch(addToken(`http://localhost:${port}/import/${key}`, res));
      })
    )
      .then(() => {
        trans(true, {message: '/import/all completed'});
        resolve(true);
      })
      .catch(err => {
        trans(false, {message: err});
        logError(err);
        reject(err);
      });
  });

  res.status(200).json({message: 'Import of all harvesters initiated'});
});

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
  const trans = startTransaction({
    ...localTokens(res),
    name: '/import/:harvester',
    type: 'get',
    subtype: req.params.harvester,
  });

  if (!(req.params.harvester in harvesters)) {
    logError(`harvester not found: ${req.params.harvester}`);
    simpleResponse(404, 'harvester type does not exist', res, trans);
  } else if (harvesters[req.params.harvester].active) {
    simpleResponse(
      200,
      'import on this harvester already in progress',
      res,
      trans
    );
  } else {
    harvesters[req.params.harvester]
      .check(trans)
      .then(result => {
        if (!result) {
          res.status(200).json({message: 'Nothing to import'});
        } else {
          res.status(200).json({message: 'Initiating import'});
        }
      })
      .catch(err => {
        logError(err);
        res.status(500).json({message: err});
      });
  }
});

catchAll();
