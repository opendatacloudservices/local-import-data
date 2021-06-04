import type { Client } from 'pg';
export declare const resetTables: (client: Client) => Promise<void>;
export declare const duplicateByUrl: (client: Client) => Promise<void>;
