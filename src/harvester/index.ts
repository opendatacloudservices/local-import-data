import {Client} from 'pg';

export class Harvester {
  client: Client;
  harvesterName = '';

  constructor(harvesterName: string) {
    if (!harvesterName) {
      throw new Error('harvesterName not set.');
    }

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

  // import a dataset
  import(instance: number, dataset: number): Promise<void> {
    console.log(instance, dataset);
    return Promise.resolve();
  }

  // check if there are more datasets to import
  check(): Promise<boolean> {
    return Promise.resolve(false);
  }
}
