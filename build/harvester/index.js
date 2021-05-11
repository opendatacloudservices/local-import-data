"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Harvester = void 0;
const pg_1 = require("pg");
const local_logger_1 = require("local-logger");
const utilities_node_1 = require("utilities-node");
class Harvester {
    constructor(harvesterName, _globalClient) {
        this.harvesterName = '';
        this.active = false;
        if (!harvesterName) {
            throw new Error('harvesterName not set.');
        }
        this.globalClient = _globalClient;
        this.harvesterName = harvesterName.toUpperCase();
        this.client = new pg_1.Client({
            user: process.env[`PG${this.harvesterName}USER`],
            host: process.env[`PG${this.harvesterName}HOST`],
            database: process.env[`PG${this.harvesterName}DATABASE`],
            password: process.env[`PG${this.harvesterName}PASSWORD`],
            port: parseInt(process.env[`PG${this.harvesterName}PORT`] || '5432'),
        });
        this.client.connect();
    }
    // check if there are more datasets to import
    check(trans) {
        return this.getNext().then(next => {
            if (next.length >= 1) {
                if (!this.active) {
                    this.import(next)
                        .then(() => {
                        trans(true, { message: 'import run completed' });
                        // TODO: run check again, in case something was modified in the meantime
                    })
                        .catch(err => {
                        trans(false, { message: err });
                    });
                    return true;
                }
                else {
                    trans(true, { message: 'import already running' });
                    return true;
                }
            }
            else {
                trans(true, { message: 'nothing to do' });
                return false;
            }
        });
    }
    getNext() {
        return Promise.resolve([]);
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async import(next) {
        return Promise.resolve(true);
    }
    // check if a dataset already exists
    exists(harvester, harvester_instance_id, harvester_dataset_id) {
        return this.globalClient
            .query('SELECT id FROM "Datasets" WHERE harvester = $1 AND harvester_instance_id = $2 AND harvester_dataset_id = $3', [harvester, harvester_instance_id, harvester_dataset_id])
            .then(result => {
            if (result.rows.length > 0) {
                return Promise.resolve(result.rows[0].id);
            }
            else {
                return Promise.resolve(null);
            }
        });
    }
    // insert dataset into central database
    insertDataset(datasetObj) {
        return this.globalClient
            .query('INSERT INTO "Datasets" (harvester, harvester_instance_id, harvester_dataset_id, meta_name, meta_license, meta_owner, meta_created, meta_modified) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id', [
            datasetObj.harvester,
            datasetObj.harvester_instance_id,
            datasetObj.harvester_dataset_id,
            datasetObj.name,
            datasetObj.license,
            datasetObj.owner,
            datasetObj.created,
            datasetObj.modified,
        ])
            .then(result => {
            return Promise.resolve(result.rows[0].id);
        });
    }
    async insertDatasetAttributes(datasetObj, datasetId, state) {
        if (datasetObj.tags && datasetObj.tags.length > 0) {
            const values = [];
            datasetObj.tags.forEach(tag => {
                values.push(...[datasetId, 'tag', tag]);
            });
            try {
                await this.globalClient.query(`INSERT INTO "Taxonomies" (dataset_id, type, value) VALUES ${datasetObj.tags
                    .map((d, i) => `(${utilities_node_1.dollarList(i * 3, 3)})`)
                    .join(',')}`, values);
            }
            catch (err) {
                local_logger_1.logError(err);
                console.log(err);
                throw err;
            }
        }
        if (datasetObj.groups && datasetObj.groups.length > 0) {
            const values = [];
            datasetObj.groups.forEach(group => {
                values.push(...[datasetId, 'category', group]);
            });
            try {
                await this.globalClient.query(`INSERT INTO "Taxonomies" (dataset_id, type, value) VALUES ${datasetObj.groups
                    .map((d, i) => `(${utilities_node_1.dollarList(i * 3, 3)})`)
                    .join(',')}`, values);
            }
            catch (err) {
                local_logger_1.logError(err);
                console.log(err);
                throw err;
            }
        }
        if (datasetObj.resources && datasetObj.resources.length > 0) {
            const values = [];
            datasetObj.resources.forEach(resource => {
                values.push(...[
                    datasetId,
                    resource.url,
                    state,
                    resource.name,
                    resource.format,
                    resource.size,
                    resource.license,
                ]);
            });
            try {
                await this.globalClient.query(`INSERT INTO "Files" (dataset_id, meta_url, state, meta_name, meta_format, meta_size, meta_license) VALUES ${datasetObj.resources
                    .map((d, i) => `(${utilities_node_1.dollarList(i * 7, 7)})`)
                    .join(',')}`, values);
            }
            catch (err) {
                local_logger_1.logError(err);
                console.log(err);
                throw err;
            }
        }
        return Promise.resolve();
    }
    async updateDataset(datasetObj, id) {
        // we don't care about changes, only current state
        try {
            await this.globalClient.query('UPDATE "Datasets" SET meta_name = $1, meta_license = $2, meta_owner = $3, meta_created = $4, meta_modified = $5 WHERE id = $6', [
                datasetObj.name,
                datasetObj.license,
                datasetObj.owner,
                datasetObj.created,
                datasetObj.modified,
                id,
            ]);
            await this.globalClient.query('DELETE FROM "Taxonomies" WHERE dataset_id = $1', [id]);
            await this.globalClient.query('DELETE FROM "Files" WHERE dataset_id = $1', [id]);
        }
        catch (err) {
            local_logger_1.logError(err);
            console.log(err);
            throw err;
        }
        return this.insertDatasetAttributes(datasetObj, id, 'updated');
    }
}
exports.Harvester = Harvester;
//# sourceMappingURL=index.js.map