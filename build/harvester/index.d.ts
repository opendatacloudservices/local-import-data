import { Client } from 'pg';
export declare class Harvester {
    client: Client;
    harvesterName: string;
    constructor(harvesterName: string);
    import(instance: number, dataset: number): Promise<void>;
    check(): Promise<boolean>;
}
