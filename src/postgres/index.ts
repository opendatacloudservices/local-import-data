import type {Client} from 'pg';
import {tablesExist} from 'utilities-postgres';

export const resetTables = (client: Client): Promise<void> => {
  return tablesExist(client, ['Datasets', 'Files', 'Taxonomies'])
    .then(exists => {
      if (!exists) {
        return Promise.reject(
          'Looks like some of the tables you are trying to reset, do not exist.'
        );
      }
      return client.query('TRUNCATE "Files", "Taxonomies", "Datasets";');
    })
    .then(() => {
      return Promise.resolve();
    });
};

export const duplicateByUrl = (client: Client): Promise<void> => {
  return client
    .query(
      `
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
          "Files".id = duplicates.id`
    )
    .then(() => {});
};
