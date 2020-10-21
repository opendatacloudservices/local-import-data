"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Harvester = void 0;
const pg_1 = require("pg");
class Harvester {
    constructor(harvesterName, _globalClient) {
        this.harvesterName = '';
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
    // import or update a dataset
    upsert(instance, dataset) {
        console.log(instance, dataset);
        return Promise.resolve();
    }
    // check if there are more datasets to import
    check() {
        return Promise.resolve(false);
    }
}
exports.Harvester = Harvester;
//# sourceMappingURL=index.js.map