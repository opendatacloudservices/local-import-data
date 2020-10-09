# local-import-data
Import (Transform/etc.) data that has been downloaded based on the unified meta data.

## harvester
For each harvester there is a sub class in src/harvester.
Each harvester requires its separte DB credentials in .env

```
PG__NAME_OF_SUB_CLASS__HOST=localhost
PG__NAME_OF_SUB_CLASS__PORT=5432
PG__NAME_OF_SUB_CLASS__USER=________
PG__NAME_OF_SUB_CLASS__PASSWORD=________
PG__NAME_OF_SUB_CLASS__DATABASE=________
```

Replace *__NAME_OF_SUB_CLASS__* with the name of the class.