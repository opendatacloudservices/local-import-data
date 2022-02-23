"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metaFromDownloadedFile = exports.duplicateByUrl = exports.resetTables = void 0;
const utilities_postgres_1 = require("@opendatacloudservices/utilities-postgres");
const resetTables = (client) => {
    return (0, utilities_postgres_1.tablesExist)(client, ['Imports', 'Files', 'Taxonomies', 'Contacts'])
        .then(exists => {
        if (!exists) {
            return Promise.reject('Looks like some of the tables you are trying to reset, do not exist.');
        }
        return client.query('TRUNCATE "Files", "Taxonomies", "Contacts", "Imports" CASCADE;');
    })
        .then(() => {
        return Promise.resolve();
    });
};
exports.resetTables = resetTables;
const duplicateByUrl = (client) => {
    return client
        .query(`
      WWITH duplicates AS (
        SELECT
        id, meta_url, (
          SELECT
            t2.id
          FROM
            "Files" AS t2
          WHERE
            t2.meta_url = t1.meta_url
            AND t1.id > t2.id
          ORDER BY
            t2.id ASC
          LIMIT 1
        ) AS dup_id
        FROM
        "Files" AS t1
        WHERE 
        (
          SELECT
            COUNT(*)
          FROM (
            SELECT
              *
            FROM
              "Files" AS t2
            WHERE
              t2.meta_url = t1.meta_url
              AND t1.id > t2.id
            ORDER BY
              t2.id ASC
          ) AS sub
        ) >= 1
        ORDER BY t1.id ASC)
        UPDATE "Files"
        SET
          duplicate = true,
          duplicate_id = duplicates.dup_id
        FROM duplicates
        WHERE
          "Files".id = duplicates.id`)
        .then(() => { });
};
exports.duplicateByUrl = duplicateByUrl;
const metaFromDownloadedFile = (client, id) => {
    return client
        .query(`
      SELECT * FROM "DownloadedFiles"
      JOIN "Downloads" ON "Downloads".id = "DownloadedFiles".download_id
      JOIN "Files" ON "Files".url = "Downloads".url
      JOIN "Imports" ON "Files".dataset_id = "Imports".id
      WHERE "DownloadedFiles".id = $1`, [id])
        .then(result => result.rows);
};
exports.metaFromDownloadedFile = metaFromDownloadedFile;
//# sourceMappingURL=index.js.map