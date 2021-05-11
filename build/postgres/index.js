"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetTables = void 0;
const utilities_postgres_1 = require("utilities-postgres");
exports.resetTables = (client) => {
    return utilities_postgres_1.tablesExist(client, ['Datasets', 'Files', 'Taxonomies'])
        .then(exists => {
        if (!exists) {
            return Promise.reject('Looks like some of the tables you are trying to reset, do not exist.');
        }
        return client.query('TRUNCATE "Files", "Taxonomies", "Datasets";');
    })
        .then(() => {
        return Promise.resolve();
    });
};
//# sourceMappingURL=index.js.map