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
const local_logger_1 = require("local-logger");
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
    index_1.resetTables(client)
        .then(() => {
        return res.status(200).json({ message: 'Tables reset' });
    })
        .catch(err => {
        local_logger_1.logError(err);
        return res.status(500).json({ message: err });
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
local_microservice_1.api.get('/master/duplicates', (req, res) => {
    index_1.duplicateByUrl(client)
        .then(() => {
        return res.status(200).json({ message: 'Duplicates identified' });
    })
        .catch(err => {
        local_logger_1.logError(err);
        return res.status(500).json({ message: err });
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
    const trans = local_logger_1.startTransaction({
        name: '/import/all',
        type: 'get',
        ...local_logger_1.localTokens(res),
    });
    new Promise((resolve, reject) => {
        Promise.all(Object.keys(harvesters).map(key => {
            return node_fetch_1.default(local_logger_1.addToken(`http://localhost:${local_microservice_1.port}/import/${key}`, res));
        }))
            .then(() => {
            trans(true, { message: '/import/all completed' });
            resolve(true);
        })
            .catch(err => {
            trans(false, { message: err });
            local_logger_1.logError(err);
            reject(err);
        });
    });
    res.status(200).json({ message: 'Import of all harvesters initiated' });
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
    const trans = local_logger_1.startTransaction({
        ...local_logger_1.localTokens(res),
        name: '/import/:harvester',
        type: 'get',
        subtype: req.params.harvester,
    });
    if (!(req.params.harvester in harvesters)) {
        local_logger_1.logError(`harvester not found: ${req.params.harvester}`);
        local_microservice_1.simpleResponse(404, 'harvester type does not exist', res, trans);
    }
    else if (harvesters[req.params.harvester].active) {
        local_microservice_1.simpleResponse(200, 'import on this harvester already in progress', res, trans);
    }
    else {
        harvesters[req.params.harvester]
            .check(trans)
            .then(result => {
            if (!result) {
                res.status(200).json({ message: 'Nothing to import' });
            }
            else {
                res.status(200).json({ message: 'Initiating import' });
            }
        })
            .catch(err => {
            local_logger_1.logError(err);
            res.status(500).json({ message: err });
        });
    }
});
local_microservice_1.api.get('/fix/url', async (req, res) => {
    const files = await client.query('SELECT id, meta_url FROM "Files" WHERE meta_url = url');
    for (let f = 0; f < files.rowCount; f += 1) {
        let cleanUrl = files.rows[f].meta_url;
        try {
            cleanUrl = decodeURI(files.rows[f].meta_url)
                .replace(/(<([^>]+)>)/gi, '')
                .trim()
                .replace(/http(s)*:\/\/(\s)+/, '');
        }
        catch (err) {
            console.log(err);
        }
        if (cleanUrl !== files.rows[f].meta_url) {
            await client.query('UPDATE "Files" SET url = $1 WHERE id = $2', [
                cleanUrl,
                files.rows[f].id,
            ]);
        }
    }
    res.status(200).json({ message: 'YAY' });
});
local_microservice_1.catchAll();
//# sourceMappingURL=index.js.map