import { Client } from 'pg';
import { Transaction } from '@opendatacloudservices/local-logger';
export declare type DataSetResource = {
    url: string;
    name: string | null;
    format: string | null;
    size?: number | null;
    license?: string | null;
    description: string | null;
    function: string | null;
    protocol: string | null;
};
export declare type DataSet = {
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
export declare class Harvester {
    client: Client;
    harvesterName: string;
    globalClient: Client;
    active: boolean;
    constructor(harvesterName: string, _globalClient: Client);
    check(trans: Transaction): Promise<boolean>;
    getNext(): Promise<{}[]>;
    import(next: {}[]): Promise<boolean>;
    exists(harvester: string, harvester_instance_id: string | number, harvester_dataset_id: string | number): Promise<number | null>;
    insertDataset(datasetObj: DataSet): Promise<number>;
    insertDatasetAttributes(datasetObj: DataSet, datasetId: number): Promise<void>;
    updateDataset(datasetObj: DataSet, id: number): Promise<number>;
}
