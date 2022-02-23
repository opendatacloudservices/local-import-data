import { DataSet, Harvester } from './index';
import { Client } from 'pg';
interface CswListItem {
    dataset: string;
    instance: number;
    prefix: string;
}
declare type CswList = Array<CswListItem>;
export declare class CSW extends Harvester {
    constructor(globalClient: Client);
    import(next: CswList): Promise<boolean>;
    getPrefix(instance: number): Promise<string>;
    getDataset(instance: number, dataset: string): Promise<DataSet>;
    insert(instance: number, dataset: string): Promise<void>;
    update(instance: number, dataset: string, id: number): Promise<void>;
    setImported(instance: number, dataset: string): Promise<void>;
    getNext(): Promise<CswList>;
}
export {};
