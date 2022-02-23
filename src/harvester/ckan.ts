import {DataSet, Harvester} from './index';
import {Client} from 'pg';
import {logError} from '@opendatacloudservices/local-logger';

interface CkanListItem {
  dataset: string;
  instance: number;
  prefix: string;
}

type CkanList = Array<CkanListItem>;

export class Ckan extends Harvester {
  constructor(globalClient: Client) {
    super('ckan', globalClient);
  }

  // import or update a dataset
  async import(next: CkanList): Promise<boolean> {
    if (next.length < 1) {
      throw new Error('import was called even though there is nothing to do');
    }

    this.active = true;

    for (let i = 0; i < next.length; i += 1) {
      try {
        const exists = await this.exists(
          'ckan',
          next[i].instance,
          next[i].dataset
        );
        if (exists) {
          await this.update(next[i].instance, next[i].dataset, exists);
        } else {
          await this.insert(next[i].instance, next[i].dataset);
        }
      } catch (err) {
        logError({err});
        throw err;
      }
    }

    this.active = false;

    return true;
  }

  getPrefix(instance: number): Promise<string> {
    return this.client
      .query('SELECT prefix FROM ckan_master WHERE id = $1', [instance])
      .then(result => result.rows[0].prefix);
  }

  getDataset(instance: number, dataset: string): Promise<DataSet> {
    const contact_prefixes = [
      'contact',
      'publisher',
      'author',
      'maintainer',
      'originator',
    ];
    return this.getPrefix(instance).then(prefix => {
      const queries = [
        `SELECT title, metadata_modified, metadata_created, license_title, author, maintainer, notes, maintainer_email, author_email FROM ${prefix}_packages WHERE id = $1`,
        `SELECT title FROM ${prefix}_ref_groups_packages JOIN ${prefix}_groups ON id = group_id WHERE package_id = $1`,
        `SELECT display_name FROM ${prefix}_ref_tags_packages JOIN ${prefix}_tags ON id = tag_id WHERE package_id = $1`,
        `SELECT name, format, url, license, size FROM ${prefix}_ref_resources_packages JOIN ${prefix}_resources ON id = resource_id WHERE package_id = $1`,
        `SELECT key, value FROM ${prefix}_extras WHERE (
          key IN ('access_rights', 'temporal_start', 'temporal_end', 'spatial')
          OR ${contact_prefixes
            .map(c => `key LIKE '${c}_%'`)
            .join(' OR ')}) AND package_id = $1`,
        `SELECT ${prefix}_organizations.title, ${prefix}_organizations.description FROM ${prefix}_packages JOIN ${prefix}_organizations ON organization_id = ${prefix}_organizations.id WHERE ${prefix}_packages.id = $1`,
      ];

      return Promise.all(
        queries.map(query => {
          return this.client.query(query, [dataset]);
        })
      ).then(results => {
        const returnObject: DataSet = {
          harvester: 'ckan',
          harvester_dataset_id: dataset,
          harvester_instance_id: instance,
          name: '',
          license: [],
          temporalStart: null,
          temporalEnd: null,
          owner: [],
          created: '',
          modified: '',
          description: '',
          groups: [],
          resources: [],
          contacts: [],
          spatial: [],
        };

        const contacts: {
          [key: string]: {
            name: string | null;
            contact: {
              [key: string]: string;
            };
          };
        } = {};

        results[4].rows.forEach(row => {
          contact_prefixes.forEach(c => {
            if (row.key.indexOf(c + '_') === 0) {
              if (!(c in contacts)) {
                contacts[c] = {
                  name: null,
                  contact: {},
                };
              }
              if (row.key === c + '_name') {
                contacts[c].name = row.value;
              } else {
                contacts[c].contact[row.key.split(c + '_')[1]] = row.value;
              }
            }
          });

          if (row.key === 'access_rights') {
            returnObject.license = Array.isArray(row.value)
              ? row.value
              : [row.value];
          } else if (row.key === 'temporal_start') {
            returnObject.temporalStart = row.value;
          } else if (row.key === 'temporal_end') {
            returnObject.temporalEnd = row.value;
          } else if (row.key === 'spatial') {
            if (row.value && 'coordinates' in JSON.parse(row.value)) {
              const coordinates = JSON.parse(row.value).coordinates;
              if (
                Array.isArray(coordinates) &&
                Array.isArray(coordinates[0]) &&
                Array.isArray(coordinates[0][0]) &&
                Array.isArray(coordinates[0][0][0]) &&
                !isNaN(coordinates[0][0][0][0])
              ) {
                if (
                  Array.isArray(coordinates[1]) &&
                  Array.isArray(coordinates[1][0]) &&
                  Array.isArray(coordinates[1][0][0])
                ) {
                  const x: number[] = [
                    ...coordinates[0][0][0].map((a: number[]) => a[0]),
                    ...coordinates[1][0][0].map((a: number[]) => a[0]),
                  ].sort();
                  const y: number[] = [
                    ...coordinates[0][0][0].map((a: number[]) => a[1]),
                    ...coordinates[1][0][0].map((a: number[]) => a[1]),
                  ].sort();

                  returnObject.spatial = [
                    x[0],
                    y[0],
                    x[x.length - 1],
                    y[y.length - 1],
                  ];
                } else {
                  returnObject.spatial = [
                    ...coordinates[0][0][0],
                    ...coordinates[0][0][2],
                  ];
                }
              } else if (
                Array.isArray(coordinates) &&
                Array.isArray(coordinates[0]) &&
                Array.isArray(coordinates[0][0]) &&
                !isNaN(coordinates[0][0][0])
              ) {
                returnObject.spatial = [
                  ...coordinates[0][0],
                  ...coordinates[0][2],
                ];
              } else if (
                Array.isArray(coordinates) &&
                coordinates.length >= 4
              ) {
                returnObject.spatial = [...coordinates[0], ...coordinates[2]];
              }
            }
          }
        });

        if (
          results[0].rows[0].author !== null &&
          results[0].rows[0].author.length > 0
        ) {
          if (!('author' in contacts)) {
            contacts['author'] = {
              name: null,
              contact: {},
            };
          }
          contacts.author.name = results[0].rows[0].author;
        }
        if (
          results[0].rows[0].author_email !== null &&
          results[0].rows[0].author_email.length > 0
        ) {
          if (!('author' in contacts)) {
            contacts['author'] = {
              name: null,
              contact: {},
            };
          }
          contacts.author.contact.email = results[0].rows[0].author_email;
        }

        if (
          results[0].rows[0].maintainer !== null &&
          results[0].rows[0].maintainer.length > 0
        ) {
          if (!('maintainer' in contacts)) {
            contacts['maintainer'] = {
              name: null,
              contact: {},
            };
          }
          contacts.maintainer.name = results[0].rows[0].maintainer;
        }
        if (
          results[0].rows[0].maintainer_email !== null &&
          results[0].rows[0].maintainer_email.length > 0
        ) {
          if (!('maintainer' in contacts)) {
            contacts['maintainer'] = {
              name: null,
              contact: {},
            };
          }
          contacts.maintainer.contact.email =
            results[0].rows[0].maintainer_email;
        }

        Object.keys(contacts).forEach(key => {
          if (contacts[key].name) {
            returnObject.contacts.push({
              ...contacts[key],
              type: key,
            });
          }
        });

        // Map data from {prefix}_packages
        returnObject.name = results[0].rows[0].title;
        if (Array.isArray(returnObject.license)) {
          returnObject.license.push(results[0].rows[0].license_title);
        }
        if (
          results[0].rows[0].author !== null &&
          results[0].rows[0].author.length > 0 &&
          Array.isArray(returnObject.owner)
        ) {
          returnObject.owner.push(results[0].rows[0].author);
        }
        if (
          results[0].rows[0].maintainer !== null &&
          results[0].rows[0].maintainer.length > 0 &&
          Array.isArray(returnObject.owner)
        ) {
          returnObject.owner.push(results[0].rows[0].maintainer);
        }
        returnObject.description = results[0].rows[0].notes;
        returnObject.created = results[0].rows[0].metadata_created;
        returnObject.modified = results[0].rows[0].metadata_modified;

        // Map data from {prefix}_groups
        results[1].rows.forEach(row => {
          returnObject.groups.push({value: row.title, class: 'category'});
        });

        // Map data from {prefix}_tags
        results[2].rows.forEach(row => {
          returnObject.groups.push({value: row.display_name, class: 'tag'});
        });

        // Map data from {prefix}_resources
        results[3].rows.forEach(row => {
          returnObject.resources.push({
            url: null,
            name: null,
            format: null,
            size: null,
            license: null,
            description: null,
            function: null,
            protocol: null,
            ...row,
          });
        });

        return returnObject;
      });
    });
  }

  insert(instance: number, dataset: string): Promise<void> {
    return this.getDataset(instance, dataset)
      .then(dataset => {
        return this.insertDataset(dataset).then(id => {
          return this.insertDatasetAttributes(dataset, id);
        });
      })
      .then(() => {
        this.setImported(instance, dataset);
      });
  }

  update(instance: number, dataset: string, id: number): Promise<void> {
    return this.getDataset(instance, dataset)
      .then(datasetObj => {
        const _dataset: DataSet = {
          ...datasetObj,
          ...{
            harvester: 'ckan',
            harvester_instance_id: instance,
            harvester_dataset_id: dataset,
          },
        };

        return this.updateDataset(_dataset, id).then(id => {
          return this.insertDatasetAttributes(_dataset, id);
        });
      })
      .then(() => {
        this.setImported(instance, dataset);
      });
  }

  setImported(instance: number, dataset: string): Promise<void> {
    return this.getPrefix(instance)
      .then(prefix => {
        return this.client
          .query(
            `UPDATE ${prefix}_packages SET ckan_status = $1 WHERE id = $2`,
            ['imported', dataset]
          )
          .catch(err => {
            logError(err);
          });
      })
      .then(() => {
        return Promise.resolve();
      });
  }

  getNext(): Promise<CkanList> {
    return this.client
      .query('SELECT id, prefix FROM ckan_master WHERE active = TRUE')
      .then(result => {
        return this.client.query(
          `${result.rows
            .map(row => {
              return `SELECT id, '${row.prefix}' AS prefix, ${row.id} AS ckan_id FROM ${row.prefix}_packages WHERE ckan_status = 'new' OR ckan_status = 'updated'`;
            })
            .join(' UNION ALL ')}`
        );
      })
      .then(result => {
        const returnArray: CkanList = [];
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
}
