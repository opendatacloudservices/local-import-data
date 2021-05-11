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
