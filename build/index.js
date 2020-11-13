"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = require("dotenv");
const path = require("path");
const pg_1 = require("pg");
const ckan_1 = require("./harvester/ckan");
const index_1 = require("./postgres/index");
const node_fetch_1 = require("node-fetch");
// get environmental variables
dotenv.config({ path: path.join(__dirname, '../.env') });
const local_microservice_1 = require("local-microservice");
// connect to postgres (via env vars params)
const client = new pg_1.Client({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: parseInt(process.env.PGPORT || '5432'),
});
client.connect();
// harvester setup
const harvesters = {};
harvesters.ckan = new ckan_1.Ckan(client);
/**
 * @swagger
 *
 * /master/init:
 *   get:
 *     operationId: getMasterInit
 *     description: Create the database structure
 *     produces:
 *       - application/json
 *     responses:
 *       500:
 *         description: error
 *       200:
 *         description: success
 */
local_microservice_1.api.get('/master/init', (req, res) => {
    const trans = local_microservice_1.startTransaction({ name: '/master/init', type: 'get' });
    index_1.initTables(client)
        .then(() => {
        res.status(200).json({
            message: 'Tables created',
        });
        trans.end('success');
    })
        .catch(err => {
        local_microservice_1.logError(err);
        trans.end('error');
        res.status(500).json({ message: err });
    });
});
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
local_microservice_1.api.get('/master/reset', (req, res) => {
    const trans = local_microservice_1.startTransaction({ name: '/master/reset', type: 'get' });
    index_1.resetTables(client)
        .then(() => {
        res.status(200).json({
            message: 'Tables reset',
        });
        trans.end('success');
    })
        .catch(err => {
        local_microservice_1.logError(err);
        trans.end('error');
        res.status(500).json({ message: err });
    });
});
/**
 * @swagger
 *
 * /master/drop:
 *   get:
 *     operationId: getMasterDrop
 *     description: Drop the database structure
 *     produces:
 *       - application/json
 *     responses:
 *       500:
 *         description: error
 *       200:
 *         description: success
 */
local_microservice_1.api.get('/master/drop', (req, res) => {
    const trans = local_microservice_1.startTransaction({ name: '/master/drop', type: 'get' });
    index_1.dropTables(client)
        .then(() => {
        res.status(200).json({
            message: 'Tables dropped',
        });
        trans.end('success');
    })
        .catch(err => {
        local_microservice_1.logError(err);
        trans.end('error');
        res.status(500).json({ message: err });
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
local_microservice_1.api.get('/import/all', (req, res) => {
    const trans = local_microservice_1.startTransaction({ name: '/import/all', type: 'get' });
    const calls = [];
    for (const key in harvesters) {
        // get port from pm2 config
        calls.push(node_fetch_1.default(`http://localhost:${local_microservice_1.port}/import/${key}`));
    }
    Promise.all(calls)
        .then(() => {
        res.status(200).json({
            message: 'Import of all harvesters finished',
        });
        trans.end('success');
    })
        .catch(err => {
        local_microservice_1.logError(err);
        trans.end('error');
        res.status(500).json({ message: err });
    });
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
local_microservice_1.api.get('/import/:harvester', (req, res) => {
    const trans = local_microservice_1.startTransaction({ name: '/import', type: 'get' });
    if (!(req.params.harvester in harvesters)) {
        local_microservice_1.logError(`harvester not found: ${req.params.harvester}`);
        res.status(404).json({ message: 'harvester type does not exist' });
    }
    else {
        harvesters[req.params.harvester]
            .check()
            .then(result => {
            if (!result) {
                res.status(200).json({ message: 'Nothing to import.' });
            }
            else {
                res.status(200).json({
                    message: 'Data imported or import already in progress (at the end of the import system will automatically check for new imports).',
                });
            }
            trans.end('success');
        })
            .catch(err => {
            console.log(err);
            local_microservice_1.logError(err);
            trans.end('error');
            res.status(500).json({ message: err });
        });
    }
});
local_microservice_1.catchAll();
//# sourceMappingURL=index.js.map