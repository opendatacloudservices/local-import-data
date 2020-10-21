import { Client } from 'pg';
export declare class Harvester {
    client: Client;
    harvesterName: string;
    globalClient: Client;
    constructor(harvesterName: string, _globalClient: Client);
    upsert(instance: number, dataset: number): Promise<void>;
    check(): Promise<boolean>;
}
