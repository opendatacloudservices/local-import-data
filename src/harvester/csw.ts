import {DataSet, Harvester} from './index';
import {Client} from 'pg';
import {logError} from '@opendatacloudservices/local-logger';
import * as moment from 'moment';

interface CswListItem {
  dataset: string;
  instance: number;
  prefix: string;
}

type CswList = Array<CswListItem>;

export class CSW extends Harvester {
  constructor(globalClient: Client) {
    super('csw', globalClient);
  }

  // import or update a dataset
  async import(next: CswList): Promise<boolean> {
    if (next.length < 1) {
      throw new Error('import was called even though there is nothing to do');
    }

    this.active = true;

    for (let i = 0; i < next.length; i += 1) {
      try {
        const exists = await this.exists(
          'csw',
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
      .query('SELECT prefix FROM csw_instances WHERE id = $1', [instance])
      .then(result => result.rows[0].prefix);
  }

  getDataset(instance: number, dataset: string): Promise<DataSet> {
    return this.getPrefix(instance).then(prefix => {
      const queries = [
        `SELECT title, abstract, date_stamp, hierarchy_level, category, temporal_start, temporal_end, temporal_start_unknown, temporal_end_unknown, spatial_description, geographic_description, ST_AsGeoJson(spatial) AS geom FROM ${prefix}_records WHERE id = $1`,
        `SELECT date, type FROM ${prefix}_dates WHERE record_id = $1`,
        `SELECT name, type, anchor FROM ${prefix}_ref_records_keywords JOIN ${prefix}_keywords ON keyword_id = id WHERE record_id = $1`,
        `SELECT name, individual_name, phone, fax, url, email, delivery_point, city, admin_area, postcode, country, type FROM ${prefix}_ref_records_contacts JOIN ${prefix}_contacts ON contact_id = id WHERE record_id = $1`,
        `SELECT distribution_format, url, application_profile, name, description, function, protocol FROM ${prefix}_resources WHERE record_id = $1`,
        `SELECT value, type FROM ${prefix}_constraints WHERE record_id = $1`,
      ];

      return Promise.all(
        queries.map(query => {
          return this.client.query(query, [dataset]);
        })
      ).then(results => {
        const returnObject: DataSet = {
          harvester: 'csw',
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
          spatialDescription: [],
        };

        // Map data from {prefix}_packages
        returnObject.name = results[0].rows[0].title;
        returnObject.description = results[0].rows[0].abstract;

        if (results[0].rows[0].hierarchy_level) {
          returnObject.groups.push({
            value: results[0].rows[0].hierarchy_level,
            class: 'hierarchy_level',
          });
        }

        if (results[0].rows[0].category) {
          returnObject.groups.push({
            value: results[0].rows[0].hierarchy_level,
            class: 'category',
          });
        }

        if (results[0].rows[0].temporal_start) {
          returnObject.temporalStart = results[0].rows[0].temporal_start;
        }

        if (results[0].rows[0].temporal_end) {
          returnObject.temporalEnd = results[0].rows[0].temporal_end;
        }

        if (
          results[0].rows[0].spatial_description &&
          Array.isArray(returnObject.spatialDescription)
        ) {
          returnObject.spatialDescription.push(
            ...results[0].rows[0].spatial_description
          );
        }

        if (
          results[0].rows[0].geographic_description &&
          Array.isArray(returnObject.spatialDescription)
        ) {
          returnObject.spatialDescription.push(
            ...results[0].rows[0].geographic_description
          );
        }

        if (results[0].rows[0].geom) {
          const coordinates = JSON.parse(results[0].rows[0].geom).coordinates;
          if (!isNaN(coordinates[0][0][0])) {
            returnObject.spatial = [...coordinates[0][0], ...coordinates[0][2]];
          } else {
            returnObject.spatial = [...coordinates[0], ...coordinates[2]];
          }
        }

        const created: Date[] = [new Date(results[0].rows[0].date_stamp)];
        const modified: Date[] = [new Date(results[0].rows[0].date_stamp)];
        results[1].rows.forEach(row => {
          if (
            row.type &&
            (row.type === 'creation' ||
              row.type === 'publication' ||
              row.type.toLowerCase().indexOf('publication') >= 0)
          ) {
            created.push(new Date(row.date));
          } else {
            modified.push(new Date(row.date));
          }
        });
        const dateSort = (a: Date, b: Date): number => {
          return b.getTime() - a.getTime();
        };
        created.sort(dateSort);
        modified.sort(dateSort);

        returnObject.created = moment(created[0]).format('YYYY-MM-DD HH:mm:ss');
        returnObject.modified = moment(created[0]).format(
          'YYYY-MM-DD HH:mm:ss'
        );

        results[2].rows.forEach(row => {
          returnObject.groups.push({
            value: row.name,
            type: row.type,
            class: 'tag',
          });
        });

        // `SELECT phone, fax, url, email, delivery_point, city, admin_area, postcode, country
        results[3].rows.forEach(row => {
          const contact: {[key: string]: string} = {};
          const contact_fields = [
            'phone',
            'fax',
            'url',
            'email',
            'delivery_point',
            'city',
            'postcode',
            'country',
          ];

          contact_fields.forEach(key => {
            if (key in row && row[key]) {
              contact[key] = row[key];
            }
          });

          returnObject.contacts.push({
            name: row.name ? row.name.join(',') : null,
            individual: row.individual_name
              ? row.individual_name.join(',')
              : null,
            region: row.admin_area ? row.admin_area.join(',') : null,
            contact,
            type: row.type,
          });
        });

        // Map data from {prefix}_resources
        results[4].rows.forEach(row => {
          returnObject.resources.push({
            url: row.url,
            name: row.name,
            format: row.application_profile || row.distribution_format,
            description: row.description,
            function: row.function,
            protocol: row.protcol,
          });
        });

        // Map data from {prefix}_contraints
        results[5].rows.forEach(row => {
          if (Array.isArray(returnObject.license)) {
            returnObject.license.push(`${row.type}::${row.value}`);
          }
        });

        return returnObject;
      });
    });
  }

  insert(instance: number, dataset: string): Promise<void> {
    return this.getDataset(instance, dataset)
      .then(datasetObj => {
        const _dataset: DataSet = {
          ...datasetObj,
          ...{
            harvester: 'csw',
            harvester_instance_id: instance,
            harvester_dataset_id: dataset,
          },
        };

        return this.insertDataset(_dataset).then(id => {
          return this.insertDatasetAttributes(_dataset, id);
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
            harvester: 'csw',
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
          .query(`UPDATE ${prefix}_records SET state = $1 WHERE id = $2`, [
            'imported',
            dataset,
          ])
          .catch(err => {
            logError(err);
          });
      })
      .then(() => {
        return Promise.resolve();
      });
  }

  getNext(): Promise<CswList> {
    return this.client
      .query('SELECT id, prefix FROM csw_instances WHERE active = TRUE')
      .then(result => {
        return this.client.query(
          `${result.rows
            .map(row => {
              return `SELECT id, '${row.prefix}' AS prefix, ${row.id} AS csw_id FROM ${row.prefix}_records WHERE state = 'new' OR state = 'updated'`;
            })
            .join(' UNION ALL ')}`
        );
      })
      .then(result => {
        const returnArray: CswList = [];
        if (result.rows.length >= 1) {
          result.rows.forEach(row => {
            returnArray.push({
              dataset: row.id.toString(),
              instance: row.csw_id,
              prefix: row.prefix,
            });
          });
        }
        return returnArray;
      });
  }
}
