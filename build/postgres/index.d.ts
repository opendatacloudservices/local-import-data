import type { Client } from 'pg';
export declare const resetTables: (client: Client) => Promise<void>;
export declare const duplicateByUrl: (client: Client) => Promise<void>;
export declare const metaFromDownloadedFile: (client: Client, id: number) => Promise<{
    [index: string]: string | number | null;
}[]>;
