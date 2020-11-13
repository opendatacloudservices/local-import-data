import { Client } from 'pg';
export declare type DataSet = {
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
export declare class Harvester {
    client: Client;
    harvesterName: string;
    globalClient: Client;
    active: boolean;
    constructor(harvesterName: string, _globalClient: Client);
    check(): Promise<boolean>;
    getNext(): Promise<{}[]>;
    import(next: {}[]): Promise<boolean>;
    exists(harvester: string, harvester_instance_id: string | number, harvester_dataset_id: string | number): Promise<number | null>;
    insertDataset(datasetObj: DataSet): Promise<number>;
    insertDatasetAttributes(datasetObj: DataSet, datasetId: number, state: string): Promise<void>;
    dollarList(start: number, length: number): string;
    updateDataset(datasetObj: DataSet, id: number): Promise<void>;
}
