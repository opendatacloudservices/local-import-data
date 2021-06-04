"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Harvester = void 0;
const pg_1 = require("pg");
const local_logger_1 = require("local-logger");
const utilities_node_1 = require("utilities-node");
const format_1 = require("../format");
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
            .query('SELECT id FROM "Imports" WHERE harvester = $1 AND harvester_instance_id = $2 AND harvester_dataset_id = $3', [harvester, harvester_instance_id, harvester_dataset_id])
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
            .query(`INSERT INTO
          "Imports"
          (harvester, harvester_instance_id, harvester_dataset_id, meta_name, meta_license, meta_owner, meta_created, meta_modified)
        VALUES
          (${utilities_node_1.dollarList(0, 8)})
        RETURNING id`, [
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
    async insertDatasetAttributes(datasetObj, datasetId) {
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
                throw err;
            }
        }
        if (datasetObj.resources && datasetObj.resources.length > 0) {
            try {
                for (let r = 0; r < datasetObj.resources.length; r += 1) {
                    const values = [
                        datasetId,
                        datasetObj.resources[r].url,
                        datasetObj.resources[r].name,
                        datasetObj.resources[r].format,
                        datasetObj.resources[r].size,
                        datasetObj.resources[r].license,
                        format_1.mimeType(datasetObj.resources[r].url),
                        format_1.standardizeFormat(datasetObj.resources[r].format),
                    ];
                    const duplicates = await this.globalClient.query('SELECT id FROM "Files" WHERE duplicate = FALSE AND meta_url = $1', [datasetObj.resources[r].url]);
                    if (duplicates.rows.length > 0) {
                        values.push(true);
                        values.push(duplicates.rows[0].id);
                    }
                    await this.globalClient.query(`INSERT INTO
              "Files"
              (dataset_id, meta_url, meta_name, meta_format, meta_size, meta_license, mimetype, format${values.length === 10 ? ', duplicate, duplicate_id' : ''})
            VALUES
              (${utilities_node_1.dollarList(0, values.length)})
            RETURNING id`, values);
                    // As we harvest datasets from various places and meta data is not identical, the URLs are the only way of identifying duplicates.
                    // Therefore, in the Downloads table, the urls serve as unique identifiers, to make sure we don't download and process the same file twice.
                    // Determine if there is a pending download
                    // Some urls have weird html inside:
                    let cleanUrl = datasetObj.resources[r].url;
                    // some urls are so messed up they cannot be decoded
                    try {
                        cleanUrl = decodeURI(datasetObj.resources[r].url)
                            .replace(/(<([^>]+)>)/gi, '')
                            .trim()
                            .replace(/http(s)*:\/\/(\s)+/, '');
                    }
                    catch (err) {
                        console.log(err);
                    }
                    const pendingDownloads = await this.globalClient.query('SELECT id FROM "Downloads" WHERE url = $1 AND state = \'new\'', [cleanUrl]);
                    if (pendingDownloads.rows.length === 0) {
                        // Determine if this should create a download
                        const duplicateDownloads = await this.globalClient.query('SELECT id, downloaded FROM "Downloads" WHERE url = $1 ORDER BY downloaded DESC LIMIT 1', [cleanUrl]);
                        if (duplicateDownloads.rows.length > 0) {
                            const diff = new Date(duplicateDownloads.rows[0]['downloaded']).getTime() -
                                new Date(datasetObj.modified).getTime();
                            // If the meta data was modified after the latest download, a new download should be triggered
                            if (diff < 0) {
                                await this.globalClient.query('INSERT INTO "Downloads" (url, state, previous, format, mimetype) VALUES ($1, \'new\', $2, $3, $4)', [
                                    cleanUrl,
                                    duplicateDownloads.rows[0].id,
                                    datasetObj.resources[r].format,
                                    format_1.mimeType(cleanUrl),
                                ]);
                            }
                        }
                        else {
                            await this.globalClient.query('INSERT INTO "Downloads" (url, state, format, mimetype) VALUES ($1, \'new\', $2, $3)', [cleanUrl, datasetObj.resources[r].format, format_1.mimeType(cleanUrl)]);
                        }
                    }
                }
            }
            catch (err) {
                local_logger_1.logError(err);
                throw err;
            }
        }
        return Promise.resolve();
    }
    updateDataset(datasetObj, id) {
        return this.globalClient
            .query(`INSERT INTO
          "Imports"
          (harvester, harvester_instance_id, harvester_dataset_id, meta_name, meta_license, meta_owner, meta_created, meta_modified, previous_dataset_id)
        VALUES
          (${utilities_node_1.dollarList(0, 9)})
        RETURNING id`, [
            datasetObj.harvester,
            datasetObj.harvester_instance_id,
            datasetObj.harvester_dataset_id,
            datasetObj.name,
            datasetObj.license,
            datasetObj.owner,
            datasetObj.created,
            datasetObj.modified,
            id,
        ])
            .then(result => {
            return Promise.resolve(result.rows[0].id);
        });
    }
}
exports.Harvester = Harvester;
//# sourceMappingURL=index.js.map