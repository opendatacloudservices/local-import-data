import { Harvester } from './index';
import { Client } from 'pg';
interface CkanObject {
    dataset_id: string;
    instance_id: number;
    name: string;
    license: string;
    owner: string[];
    created: string;
    modified: string;
    tags: string[];
    groups: string[];
    resources: {
        name: string;
        format: string;
        url: string;
        license: string;
        size: number;
    }[];
}
interface CkanListItem {
    dataset: string;
    instance: number;
    prefix: string;
}
declare type CkanList = Array<CkanListItem>;
export declare class Ckan extends Harvester {
    active: boolean;
    constructor(globalClient: Client);
    import(next: CkanList): Promise<boolean>;
    getPrefix(instance: number): Promise<string>;
    getDataset(instance: number, dataset: string): Promise<CkanObject>;
    insert(instance: number, dataset: string): Promise<void>;
    dollarList(start: number, length: number): string;
    insertAttributes(datasetObj: CkanObject, datasetId: number, state: string): Promise<void>;
    update(instance: number, dataset: string, id: number): Promise<void>;
    setImported(instance: number, dataset: string): Promise<void>;
    getNext(): Promise<CkanList>;
    check(): Promise<boolean>;
}
export {};
