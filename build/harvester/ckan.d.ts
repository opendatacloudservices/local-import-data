import { DataSet, Harvester } from './index';
import { Client } from 'pg';
interface CkanListItem {
    dataset: string;
    instance: number;
    prefix: string;
}
declare type CkanList = Array<CkanListItem>;
export declare class Ckan extends Harvester {
    constructor(globalClient: Client);
    import(next: CkanList): Promise<boolean>;
    getPrefix(instance: number): Promise<string>;
    getDataset(instance: number, dataset: string): Promise<DataSet>;
    insert(instance: number, dataset: string): Promise<void>;
    update(instance: number, dataset: string, id: number): Promise<void>;
    setImported(instance: number, dataset: string): Promise<void>;
    getNext(): Promise<CkanList>;
}
export {};
