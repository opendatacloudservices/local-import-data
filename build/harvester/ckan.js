"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Ckan = void 0;
const index_1 = require("./index");
const local_microservice_1 = require("local-microservice");
class Ckan extends index_1.Harvester {
    constructor(globalClient) {
        super('ckan', globalClient);
        this.active = false;
    }
    // import or update a dataset
    async import(next) {
        if (next.length < 1) {
            throw new Error('import was called even though there is nothing to do');
        }
        this.active = true;
        for (let i = 0; i < next.length; i += 1) {
            try {
                const exists = await this.globalClient.query('SELECT id FROM datasets WHERE harvester = $1 AND harvester_instance_id = $2 AND harvester_dataset_id = $3', ['ckan', next[i].instance, next[i].dataset]);
                if (exists.rows.length > 0) {
                    await this.update(next[i].instance, next[i].dataset, exists.rows[i].id);
                }
                else {
                    await this.insert(next[i].instance, next[i].dataset);
                }
            }
            catch (err) {
                local_microservice_1.logError(err);
                console.log(err);
                throw err;
            }
        }
        this.active = false;
        return this.check();
    }
    getPrefix(instance) {
        return this.client
            .query('SELECT prefix FROM ckan_master WHERE id = $1', [instance])
            .then(result => result.rows[0].prefix);
    }
    getDataset(instance, dataset) {
        return this.getPrefix(instance).then(prefix => {
            const queries = [
                `SELECT title, metadata_modified, metadata_created, license_title, author, maintainer FROM ${prefix}_packages WHERE id = $1`,
                `SELECT title FROM ${prefix}_ref_groups_packages JOIN ${prefix}_groups ON id = group_id WHERE package_id = $1`,
                `SELECT display_name FROM ${prefix}_ref_tags_packages JOIN ${prefix}_tags ON id = tag_id WHERE package_id = $1`,
                `SELECT name, format, url, license, size FROM ${prefix}_ref_resources_packages JOIN ${prefix}_resources ON id = resource_id WHERE package_id = $1`,
            ];
            return Promise.all(queries.map(query => {
                return this.client.query(query, [dataset]);
            })).then(results => {
                const returnObject = {
                    dataset_id: dataset,
                    instance_id: instance,
                    name: '',
                    license: '',
                    owner: [],
                    created: '',
                    modified: '',
                    tags: [],
                    groups: [],
                    resources: [],
                };
                // Map data from {prefix}_packages
                returnObject.name = results[0].rows[0].title;
                returnObject.license = results[0].rows[0].license_title;
                if (results[0].rows[0].author !== null &&
                    results[0].rows[0].author.length > 0) {
                    returnObject.owner.push(results[0].rows[0].author);
                }
                if (results[0].rows[0].maintainer !== null &&
                    results[0].rows[0].maintainer.length > 0) {
                    returnObject.owner.push(results[0].rows[0].maintainer);
                }
                returnObject.created = results[0].rows[0].metadata_created;
                returnObject.modified = results[0].rows[0].metadata_modified;
                // Map data from {prefix}_groups
                results[1].rows.forEach(row => {
                    returnObject.groups.push(row.title);
                });
                // Map data from {prefix}_tags
                results[2].rows.forEach(row => {
                    returnObject.tags.push(row.display_name);
                });
                // Map data from {prefix}_resources
                results[3].rows.forEach(row => {
                    returnObject.resources.push(row);
                });
                return returnObject;
            });
        });
    }
    insert(instance, dataset) {
        return this.getDataset(instance, dataset)
            .then(datasetObj => {
            return this.globalClient
                .query('INSERT INTO datasets (harvester, harvester_instance_id, harvester_dataset_id, meta_name, meta_license, meta_owner, meta_created, meta_modified) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id', [
                'ckan',
                instance,
                dataset,
                datasetObj.name,
                datasetObj.license,
                datasetObj.owner,
                datasetObj.created,
                datasetObj.modified,
            ])
                .then(result => {
                return this.insertAttributes(datasetObj, result.rows[0].id, 'new');
            });
        })
            .then(() => {
            this.setImported(instance, dataset);
        });
    }
    // TODO: Move to utilities
    dollarList(start, length) {
        const r = [];
        for (let i = start; i < start + length; i += 1) {
            r.push(`$${i + 1}`);
        }
        return r.join(',');
    }
    async insertAttributes(datasetObj, datasetId, state) {
        if (datasetObj.tags.length > 0) {
            const values = [];
            datasetObj.tags.forEach(tag => {
                values.push(...[datasetId, 'tag', tag]);
            });
            try {
                await this.globalClient.query(`INSERT INTO taxonomies (dataset_id, type, value) VALUES ${datasetObj.tags
                    .map((d, i) => `(${this.dollarList(i * 3, 3)})`)
                    .join(',')}`, values);
            }
            catch (err) {
                local_microservice_1.logError(err);
                console.log(err);
                throw err;
            }
        }
        if (datasetObj.groups.length > 0) {
            const values = [];
            datasetObj.groups.forEach(group => {
                values.push(...[datasetId, 'category', group]);
            });
            try {
                await this.globalClient.query(`INSERT INTO taxonomies (dataset_id, type, value) VALUES ${datasetObj.groups
                    .map((d, i) => `(${this.dollarList(i * 3, 3)})`)
                    .join(',')}`, values);
            }
            catch (err) {
                local_microservice_1.logError(err);
                console.log(err);
                throw err;
            }
        }
        if (datasetObj.resources.length > 0) {
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
                await this.globalClient.query(`INSERT INTO files (dataset_id, meta_url, state, meta_name, meta_format, meta_size, meta_license) VALUES ${datasetObj.resources
                    .map((d, i) => `(${this.dollarList(i * 7, 7)})`)
                    .join(',')}`, values);
            }
            catch (err) {
                local_microservice_1.logError(err);
                console.log(err);
                throw err;
            }
        }
        return Promise.resolve();
    }
    update(instance, dataset, id) {
        return this.getDataset(instance, dataset)
            .then(async (datasetObj) => {
            // we don't care about changes, only current state
            try {
                await this.globalClient.query('UPDATE datasets SET meta_name = $1, meta_license = $2, meta_owner = $3, meta_created = $4, meta_modified = $5 WHERE id = $6', [
                    datasetObj.name,
                    datasetObj.license,
                    datasetObj.owner,
                    datasetObj.created,
                    datasetObj.modified,
                    id,
                ]);
                await this.globalClient.query('DELETE FROM taxonomies WHERE dataset_id = $1', [id]);
                await this.globalClient.query('DELETE FROM files WHERE dataset_id = $1', [id]);
            }
            catch (err) {
                local_microservice_1.logError(err);
                console.log(err);
                throw err;
            }
            return this.insertAttributes(datasetObj, id, 'updated');
        })
            .then(() => {
            this.setImported(instance, dataset);
        });
    }
    setImported(instance, dataset) {
        return this.getPrefix(instance)
            .then(prefix => {
            return this.client
                .query(`UPDATE ${prefix}_packages SET ckan_status = $1 WHERE id = $2`, ['imported', dataset])
                .catch(err => {
                local_microservice_1.logError(err);
                console.log(err);
            });
        })
            .then(() => {
            return Promise.resolve();
        });
    }
    getNext() {
        return this.client
            .query('SELECT id, prefix FROM ckan_master WHERE active = TRUE')
            .then(result => {
            return this.client.query(`${result.rows
                .map(row => {
                return `SELECT id, '${row.prefix}' AS prefix, ${row.id} AS ckan_id FROM ${row.prefix}_packages WHERE ckan_status = 'new' OR ckan_status = 'updated'`;
            })
                .join(' UNION ALL ')}`);
        })
            .then(result => {
            const returnArray = [];
            if (result.rows.length >= 1) {
                result.rows.forEach(row => {
                    returnArray.push({
                        dataset: row.id.toString(),
                        instance: row.ckan_id,
                        prefix: row.prefix,
                    });
                });
            }
            return returnArray;
        });
    }
    // check if there are more datasets to import
    check() {
        return this.getNext().then(next => {
            if (next.length >= 1) {
                if (!this.active) {
                    return this.import(next).then(() => true);
                }
                else {
                    return true;
                }
            }
            else {
                return false;
            }
        });
    }
}
exports.Ckan = Ckan;
//# sourceMappingURL=ckan.js.map