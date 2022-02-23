import {Client} from 'pg';
import {logError, Transaction} from '@opendatacloudservices/local-logger';
import {dollarList} from '@opendatacloudservices/utilities-node';
import {standardizeFormat, mimeType} from '../format';
import * as moment from 'moment';

export type DataSetResource = {
  url: string;
  name: string | null;
  format: string | null;
  size?: number | null;
  license?: string | null;
  description: string | null;
  function: string | null;
  protocol: string | null;
};

export type DataSet = {
  harvester: string;
  harvester_instance_id: number | string;
  harvester_dataset_id: number | string;
  name: string | null;
  license: string[] | null;
  owner: string[] | null;
  created: string;
  modified: string;
  temporalStart: string | null;
  temporalEnd: string | null;
  spatial: number[] | null;
  spatialDescription?: string[] | null;
  groups: {
    value: string | null;
    type?: string | null;
    class: string;
  }[];
  description?: string | null;
  resources: DataSetResource[];
  contacts: {
    name: string | null;
    individual?: string | null;
    region?: string | null;
    contact?: {
      [key: string]: string | null;
    };
    type?: string | null;
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
  check(trans: Transaction): Promise<boolean> {
    return this.getNext().then(next => {
      if (next.length >= 1) {
        if (!this.active) {
          this.import(next)
            .then(() => {
              trans(true, {message: 'import run completed'});
              // TODO: run check again, in case something was modified in the meantime
            })
            .catch(err => {
              console.log(err);
              trans(false, {message: err});
            });
          return true;
        } else {
          trans(true, {message: 'import already running'});
          return true;
        }
      } else {
        trans(true, {message: 'nothing to do'});
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
        'SELECT id FROM "Imports" WHERE harvester = $1 AND harvester_instance_id = $2 AND harvester_dataset_id = $3',
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
    let values = [
      datasetObj.harvester,
      datasetObj.harvester_instance_id,
      datasetObj.harvester_dataset_id,
      datasetObj.name,
      datasetObj.license,
      datasetObj.owner,
      moment(datasetObj.created).isValid()
        ? moment(datasetObj.created).format('YYYY-MM-DD HH:mm:ss')
        : null,
      moment(datasetObj.modified).isValid()
        ? moment(datasetObj.modified).format('YYYY-MM-DD HH:mm:ss')
        : null,
      datasetObj.description,
      moment(datasetObj.temporalStart).isValid()
        ? moment(datasetObj.temporalStart).format('YYYY-MM-DD HH:mm:ss')
        : null,
      moment(datasetObj.temporalEnd).isValid()
        ? moment(datasetObj.temporalEnd).format('YYYY-MM-DD HH:mm:ss')
        : null,
      datasetObj.spatialDescription,
    ];
    if (datasetObj.spatial && datasetObj.spatial.length === 4) {
      values = [...values, ...datasetObj.spatial];
    } else {
      values.push(null);
    }
    return this.globalClient
      .query(
        `INSERT INTO
          "Imports"
          (
            harvester,
            harvester_instance_id,
            harvester_dataset_id,
            meta_name,
            meta_license,
            meta_owner,
            meta_created,
            meta_modified,
            meta_abstract,
            temporal_start,
            temporal_end,
            spatial_description,
            bbox
          )
        VALUES
          (${dollarList(0, 12)}${
          datasetObj.spatial && datasetObj.spatial.length === 4
            ? ', ST_MakeEnvelope($13, $14, $15, $16, 4326)'
            : ', $13'
        })
        RETURNING id`,
        values
      )
      .then(result => {
        return Promise.resolve(result.rows[0].id);
      });
  }

  async insertDatasetAttributes(
    datasetObj: DataSet,
    datasetId: number
  ): Promise<void> {
    // PROCESS GROUPS/CATEGORIES :----------
    if (datasetObj.groups && datasetObj.groups.length > 0) {
      const values: (string | number | null)[] = [];
      datasetObj.groups.forEach(group => {
        let duplicate = false;
        for (let i = 0; i < values.length; i += 2) {
          if (
            values[i] ===
              (group.value ? group.value.toLowerCase().trim() : '') &&
            values[i + 1] ===
              (group.type ? group.type.toLowerCase().trim() : '')
          ) {
            duplicate = true;
          }
        }
        if (!duplicate) {
          values.push(
            ...[
              group.value ? group.value.toLowerCase().trim() : '',
              group.type ? group.type.toLowerCase().trim() : '',
            ]
          );
        }
      });
      try {
        let qs = '';
        for (let i = 0; i < values.length / 2; i += 1) {
          if (i > 0) {
            qs += ',';
          }
          qs += `(${dollarList(i * 2, 2)})`;
        }
        const taxonomy_ids = await this.globalClient.query(
          `INSERT INTO "Taxonomies" (value, type) VALUES ${qs}
          ON CONFLICT (value, type) DO UPDATE SET value = EXCLUDED.value
          RETURNING id`,
          values
        );

        await this.globalClient.query(
          `INSERT INTO "_TaxonomiesToImports" (taxonomies_id, imports_id, type) VALUES ${taxonomy_ids.rows
            .map((_d, i) => `(${dollarList(i * 3, 3)})`)
            .join(',')}`,
          taxonomy_ids.rows
            .map((row, ri) => [row.id, datasetId, datasetObj.groups[ri].class])
            .reduce((acc, val) => acc.concat(val), [])
        );
      } catch (err) {
        logError({err});
        throw err;
      }
    }
    if (datasetObj.contacts && datasetObj.contacts.length > 0) {
      const values: (string | number | null)[] = [];
      datasetObj.contacts.forEach(contact => {
        // check if the value isn't already in the list
        let duplicate = false;
        for (let i = 0; i < values.length; i += 4) {
          if (
            values[i] ===
              (contact.name ? contact.name.toLowerCase().trim() : '') &&
            values[i + 1] ===
              (contact.individual
                ? contact.individual.toLowerCase().trim()
                : '')
          ) {
            duplicate = true;
          }
        }

        if (!duplicate) {
          values.push(
            ...[
              contact.name ? contact.name.toLowerCase().trim() : '',
              contact.individual ? contact.individual.toLowerCase().trim() : '',
              contact.region ? contact.region : null,
              contact.contact ? JSON.stringify(contact.contact) : null,
            ]
          );
        }
      });
      try {
        let qs = '';
        for (let i = 0; i < values.length / 4; i += 1) {
          if (i > 0) {
            qs += ',';
          }
          qs += `(${dollarList(i * 4, 4)})`;
        }
        const contacts_ids = await this.globalClient.query(
          `INSERT INTO "Contacts" (name, individual, region, contact) VALUES ${qs}
          ON CONFLICT (name, individual) DO UPDATE SET name = EXCLUDED.name
          RETURNING id`,
          values
        );

        await this.globalClient.query(
          `INSERT INTO "_ContactsToImports" (contacts_id, imports_id, type) VALUES ${contacts_ids.rows
            .map((_d, i) => `(${dollarList(i * 3, 3)})`)
            .join(',')}`,
          contacts_ids.rows
            .map((row, ri) => [row.id, datasetId, datasetObj.contacts[ri].type])
            .reduce((acc, val) => acc.concat(val), [])
        );
      } catch (err) {
        logError({err});
        throw err;
      }
    }
    // PROCESS RESOURCES :----------
    if (datasetObj.resources && datasetObj.resources.length > 0) {
      try {
        for (let r = 0; r < datasetObj.resources.length; r += 1) {
          // Some urls have weird html inside:
          let cleanUrl = datasetObj.resources[r].url;
          // some urls are so messed up they cannot be decoded
          try {
            cleanUrl = decodeURI(datasetObj.resources[r].url)
              .replace(/(<([^>]+)>)/gi, '')
              .trim();

            const spaceAfterProtocol = cleanUrl.match(/http(s?):\/\/(\s)+/);
            if (spaceAfterProtocol) {
              cleanUrl = cleanUrl.replace(
                spaceAfterProtocol[0],
                spaceAfterProtocol[0].trim()
              );
            }
          } catch (err) {
            logError({message: err});
          }

          const values: (number | string | boolean | null)[] = [
            datasetId,
            datasetObj.resources[r].url,
            cleanUrl,
            datasetObj.resources[r].name,
            datasetObj.resources[r].format,
            datasetObj.resources[r].size || null,
            datasetObj.resources[r].license || null,
            mimeType(datasetObj.resources[r].url),
            standardizeFormat(
              datasetObj.resources[r].format || 'unknown',
              datasetObj.resources[r].url
            ),
            datasetObj.resources[r].description,
            datasetObj.resources[r].function,
            datasetObj.resources[r].protocol, // TODO merge with format?
          ];
          const duplicates = await this.globalClient.query(
            'SELECT id FROM "Files" WHERE duplicate = FALSE AND meta_url = $1',
            [datasetObj.resources[r].url]
          );
          if (duplicates.rows.length > 0) {
            values.push(true);
            values.push(duplicates.rows[0].id);
          }
          await this.globalClient.query(
            `INSERT INTO
              "Files"
              (
                dataset_id,
                meta_url,
                url,
                meta_name,
                meta_format,
                meta_size,
                meta_license,
                mimetype,
                format,
                meta_description,
                meta_function,
                meta_protocol${
                  values.length === 14 ? ', duplicate, duplicate_id' : ''
                }
              )
            VALUES
              (${dollarList(0, values.length)})
            RETURNING id`,
            values
          );
          // As we harvest datasets from various places and meta data is not identical, the URLs are the only way of identifying duplicates.
          // Therefore, in the Downloads table, the urls serve as unique identifiers, to make sure we don't download and process the same file twice.
          // Determine if there is a pending download

          const pendingDownloads = await this.globalClient.query(
            'SELECT id FROM "Downloads" WHERE url = $1 AND state = \'new\'',
            [cleanUrl]
          );
          if (pendingDownloads.rows.length === 0) {
            // Determine if this should create a download
            const duplicateDownloads = await this.globalClient.query(
              'SELECT id, downloaded FROM "Downloads" WHERE url = $1 ORDER BY downloaded DESC LIMIT 1',
              [cleanUrl]
            );
            if (duplicateDownloads.rows.length > 0) {
              const diff =
                new Date(duplicateDownloads.rows[0]['downloaded']).getTime() -
                new Date(datasetObj.modified).getTime();

              // If the meta data was modified after the latest download, a new download should be triggered
              if (diff < 0) {
                await this.globalClient.query(
                  'INSERT INTO "Downloads" (url, state, previous, format, mimetype) VALUES ($1, \'new\', $2, $3, $4)',
                  [
                    cleanUrl,
                    duplicateDownloads.rows[0].id,
                    standardizeFormat(
                      datasetObj.resources[r].format || 'unknown',
                      datasetObj.resources[r].url
                    ),
                    mimeType(cleanUrl),
                  ]
                );
              }
            } else {
              await this.globalClient.query(
                'INSERT INTO "Downloads" (url, state, format, mimetype) VALUES ($1, \'new\', $2, $3)',
                [
                  cleanUrl,
                  standardizeFormat(
                    datasetObj.resources[r].format || 'unknown',
                    datasetObj.resources[r].url
                  ),
                  mimeType(cleanUrl),
                ]
              );
            }
          }
        }
      } catch (err) {
        logError({err});
        throw err;
      }
    }
    return Promise.resolve();
  }

  updateDataset(datasetObj: DataSet, id: number): Promise<number> {
    let values = [
      datasetObj.harvester,
      datasetObj.harvester_instance_id,
      datasetObj.harvester_dataset_id,
      datasetObj.name,
      datasetObj.license,
      datasetObj.owner,
      moment(datasetObj.created).isValid()
        ? moment(datasetObj.created).format('YYYY-MM-DD HH:mm:ss')
        : null,
      moment(datasetObj.modified).isValid()
        ? moment(datasetObj.modified).format('YYYY-MM-DD HH:mm:ss')
        : null,
      datasetObj.description,
      moment(datasetObj.temporalStart).isValid()
        ? moment(datasetObj.temporalStart).format('YYYY-MM-DD HH:mm:ss')
        : null,
      moment(datasetObj.temporalEnd).isValid()
        ? moment(datasetObj.temporalEnd).format('YYYY-MM-DD HH:mm:ss')
        : null,
      datasetObj.spatialDescription,
    ];
    if (datasetObj.spatial && datasetObj.spatial.length === 4) {
      values = [...values, ...datasetObj.spatial];
    } else {
      values.push(null);
    }
    values.push(id);

    return this.globalClient
      .query(
        `INSERT INTO
          "Imports"
          (
            harvester,
            harvester_instance_id,
            harvester_dataset_id,
            meta_name,
            meta_license,
            meta_owner,
            meta_created,
            meta_modified,
            meta_abstract,
            temporal_start,
            temporal_end,
            spatial_description,
            bbox,
            previous_dataset_id
          )
        VALUES
          (${dollarList(0, 12)}${
          datasetObj.spatial && datasetObj.spatial.length === 4
            ? ', ST_MakeEnvelope($13, $14, $15, $16, 4326), $17'
            : ', $13, $14'
        })
        RETURNING id`,
        values
      )
      .then(result => {
        return Promise.resolve(result.rows[0].id);
      });
  }
}
