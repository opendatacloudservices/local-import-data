import {Client} from 'pg';
import {logError} from 'local-microservice';

export type DataSet = {
  harvester: string;
  harvester_instance_id: number | string;
  harvester_dataset_id: number | string;
  name: string;
  license: string;
  owner: string[];
  created: string;
  modified: string;
  tags?: string[];
  groups?: string[];
  resources?: {
    url: string;
    name: string;
    format: string;
    size: number;
    license: string;
  }[];
};

export class Harvester {
  client: Client;
  harvesterName = '';
  globalClient: Client;
  active = false;

  constructor(harvesterName: string, _globalClient: Client) {
    if (!harvesterName) {
      throw new Error('harvesterName not set.');
    }

    this.globalClient = _globalClient;

    this.harvesterName = harvesterName.toUpperCase();

    this.client = new Client({
      user: process.env[`PG${this.harvesterName}USER`],
      host: process.env[`PG${this.harvesterName}HOST`],
      database: process.env[`PG${this.harvesterName}DATABASE`],
      password: process.env[`PG${this.harvesterName}PASSWORD`],
      port: parseInt(process.env[`PG${this.harvesterName}PORT`] || '5432'),
    });

    this.client.connect();
  }

  // check if there are more datasets to import
  check(): Promise<boolean> {
    return this.getNext().then(next => {
      if (next.length >= 1) {
        if (!this.active) {
          return this.import(next).then(() => true);
        } else {
          return true;
        }
      } else {
        return false;
      }
    });
  }

  getNext(): Promise<{}[]> {
    return Promise.resolve([]);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async import(next: {}[]): Promise<boolean> {
    return Promise.resolve(true);
  }

  // check if a dataset already exists
  exists(
    harvester: string,
    harvester_instance_id: string | number,
    harvester_dataset_id: string | number
  ): Promise<number | null> {
    return this.globalClient
      .query(
        'SELECT id FROM datasets WHERE harvester = $1 AND harvester_instance_id = $2 AND harvester_dataset_id = $3',
        [harvester, harvester_instance_id, harvester_dataset_id]
      )
      .then(result => {
        if (result.rows.length > 0) {
          return Promise.resolve(result.rows[0].id);
        } else {
          return Promise.resolve(null);
        }
      });
  }

  // insert dataset into central database
  insertDataset(datasetObj: DataSet): Promise<number> {
    return this.globalClient
      .query(
        'INSERT INTO datasets (harvester, harvester_instance_id, harvester_dataset_id, meta_name, meta_license, meta_owner, meta_created, meta_modified) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
        [
          datasetObj.harvester,
          datasetObj.harvester_instance_id,
          datasetObj.harvester_dataset_id,
          datasetObj.name,
          datasetObj.license,
          datasetObj.owner,
          datasetObj.created,
          datasetObj.modified,
        ]
      )
      .then(result => {
        return Promise.resolve(result.rows[0].id);
      });
  }

  async insertDatasetAttributes(
    datasetObj: DataSet,
    datasetId: number,
    state: string
  ): Promise<void> {
    if (datasetObj.tags && datasetObj.tags.length > 0) {
      const values: (string | number)[] = [];
      datasetObj.tags.forEach(tag => {
        values.push(...[datasetId, 'tag', tag]);
      });
      try {
        await this.globalClient.query(
          `INSERT INTO taxonomies (dataset_id, type, value) VALUES ${datasetObj.tags
            .map((d, i) => `(${this.dollarList(i * 3, 3)})`)
            .join(',')}`,
          values
        );
      } catch (err) {
        logError(err);
        console.log(err);
        throw err;
      }
    }
    if (datasetObj.groups && datasetObj.groups.length > 0) {
      const values: (string | number)[] = [];
      datasetObj.groups.forEach(group => {
        values.push(...[datasetId, 'category', group]);
      });
      try {
        await this.globalClient.query(
          `INSERT INTO taxonomies (dataset_id, type, value) VALUES ${datasetObj.groups
            .map((d, i) => `(${this.dollarList(i * 3, 3)})`)
            .join(',')}`,
          values
        );
      } catch (err) {
        logError(err);
        console.log(err);
        throw err;
      }
    }
    if (datasetObj.resources && datasetObj.resources.length > 0) {
      const values: (string | number)[] = [];
      datasetObj.resources.forEach(resource => {
        values.push(
          ...[
            datasetId,
            resource.url,
            state,
            resource.name,
            resource.format,
            resource.size,
            resource.license,
          ]
        );
      });
      try {
        await this.globalClient.query(
          `INSERT INTO files (dataset_id, meta_url, state, meta_name, meta_format, meta_size, meta_license) VALUES ${datasetObj.resources
            .map((d, i) => `(${this.dollarList(i * 7, 7)})`)
            .join(',')}`,
          values
        );
      } catch (err) {
        logError(err);
        console.log(err);
        throw err;
      }
    }
    return Promise.resolve();
  }

  // TODO: Move to utilities
  dollarList(start: number, length: number): string {
    const r: string[] = [];

    for (let i = start; i < start + length; i += 1) {
      r.push(`$${i + 1}`);
    }

    return r.join(',');
  }

  async updateDataset(datasetObj: DataSet, id: number) {
    // we don't care about changes, only current state
    try {
      await this.globalClient.query(
        'UPDATE datasets SET meta_name = $1, meta_license = $2, meta_owner = $3, meta_created = $4, meta_modified = $5 WHERE id = $6',
        [
          datasetObj.name,
          datasetObj.license,
          datasetObj.owner,
          datasetObj.created,
          datasetObj.modified,
          id,
        ]
      );
      await this.globalClient.query(
        'DELETE FROM taxonomies WHERE dataset_id = $1',
        [id]
      );
      await this.globalClient.query('DELETE FROM files WHERE dataset_id = $1', [
        id,
      ]);
    } catch (err) {
      logError(err);
      console.log(err);
      throw err;
    }

    return this.insertDatasetAttributes(datasetObj, id, 'updated');
  }
}
