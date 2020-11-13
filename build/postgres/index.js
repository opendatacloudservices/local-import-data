"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dropTables = exports.resetTables = exports.tablesExist = exports.initTables = exports.tableExist = void 0;
exports.tableExist = (client, tableName) => {
    return client
        .query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${tableName}'`)
        .then(result => {
        if (result.rows.length > 0) {
            return Promise.resolve(true);
        }
        else {
            return Promise.resolve(false);
        }
    });
};
exports.initTables = (client) => {
    return client
        .query(`CREATE TABLE datasets (
      id serial NOT NULL,
      harvester text NOT NULL,
      harvester_instance_id integer,
      meta_name text,
      meta_license text,
      meta_created timestamp without time zone,
      meta_modified timestamp without time zone,
      meta_owner text[],
      harvester_dataset_id text,
      CONSTRAINT datasets_pkey PRIMARY KEY (id)  
    );`)
        .then(() => client.query(`CREATE TABLE files (
        id serial NOT NULL,
        dataset_id integer,
        meta_url text,
        file text,
        state text,
        downloaded timestamp without time zone,
        meta_name text,
        meta_format text,
        meta_size text,
        meta_license text,
        CONSTRAINT files_pkey PRIMARY KEY (id)
      );`))
        .then(() => client.query(`CREATE TABLE taxonomies(
        id serial NOT NULL,
        dataset_id integer,
        type text,
        value text,
        CONSTRAINT taxonomies_pkey PRIMARY KEY (id)
      );`))
        .then(() => Promise.resolve());
};
exports.tablesExist = (client) => {
    return Promise.all([
        exports.tableExist(client, 'datasets'),
        exports.tableExist(client, 'files'),
        exports.tableExist(client, 'taxonomies'),
    ]).then(exists => {
        if (exists.includes(false)) {
            return Promise.resolve(false);
        }
        return Promise.resolve(true);
    });
};
exports.resetTables = (client) => {
    return exports.tablesExist(client)
        .then(exists => {
        if (!exists) {
            return Promise.reject('Looks like some of the tables you are trying to reset, do not exist.');
        }
        return client.query('TRUNCATE datasets, files, taxonomies;');
    })
        .then(() => {
        return Promise.resolve();
    });
};
exports.dropTables = (client) => {
    return exports.tablesExist(client)
        .then(exists => {
        if (!exists) {
            return Promise.reject('Looks like the tables you are trying to drop, do not all exist.');
        }
        return Promise.all(['datasets', 'files', 'taxonomies'].map((name) => {
            return client.query(`DROP TABLE ${name}`);
        }));
    })
        .then(() => {
        return Promise.resolve();
    });
};
//# sourceMappingURL=index.js.map