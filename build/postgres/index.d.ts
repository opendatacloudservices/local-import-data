import { Client } from 'pg';
export declare const tableExist: (client: Client, tableName: string) => Promise<boolean>;
export declare const initTables: (client: Client) => Promise<void>;
export declare const tablesExist: (client: Client) => Promise<boolean>;
export declare const resetTables: (client: Client) => Promise<void>;
export declare const dropTables: (client: Client) => Promise<void>;
