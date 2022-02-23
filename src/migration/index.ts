import {Client} from 'pg';
import {standardizeFormat, mimeType} from '../format';

export const formatFix = async (client: Client): Promise<void> => {
  console.log('starting fix');
  const all = await client
    .query('SELECT id, format, url FROM "Downloads"')
    .then(result => result.rows);

  console.log('fixing:', all.length);

  for (let a = 0; a < all.length; a += 1) {
    const cleanFormat = await standardizeFormat(all[a].format, all[a].url);
    if (cleanFormat !== all[a].format) {
      console.log(a, all[a].format, cleanFormat);
      await client.query('UPDATE "Downloads" SET format = $1 WHERE id = $2', [
        cleanFormat,
        all[a].id,
      ]);
    }
  }

  return client
    .query("UPDATE \"Downloads\" SET state = 'new' WHERE state = 'ignore'")
    .then(() => {});
};

export const urlFix = async (client: Client): Promise<void> => {
  const rows = await client
    .query('SELECT id, url, meta_url FROM "Files" WHERE url IS NULL')
    .then(result => result.rows);

  for (let r = 0; r < rows.length; r += 1) {
    const row = rows[r];
    let cleanUrl = row.meta_url;
    try {
      cleanUrl = decodeURI(row.meta_url)
        .replace(/(<([^>]+)>)/gi, '')
        .trim();

      const spaceAfterProtocol = cleanUrl.match(/http(s?):\/\/(\s)+/);
      if (spaceAfterProtocol) {
        cleanUrl = cleanUrl.replace(
          spaceAfterProtocol[0],
          spaceAfterProtocol[0].trim()
        );
      }
    } catch (err) {
      console.log({message: err});
    }
    if (cleanUrl !== row.url) {
      await client.query(
        'UPDATE "Files" SET url = $1, url_fix = TRUE WHERE id = $2',
        [cleanUrl, row.id]
      );
    } else {
      console.log('problem', row.id, row.meta_url);
    }
  }
};

export const downloadFix = async (client: Client): Promise<void> => {
  // NOTE: Memory killer!!!
  const downloads = await client
    .query('SELECT id, url, state, downloaded FROM "Downloads"')
    .then(result => result.rows);

  console.log('downloads', downloads.length);

  // NOTE: Massive Join
  const files = await client
    .query(
      'SELECT url, format, meta_modified FROM "Files" JOIN "Imports" ON dataset_id = "Imports".id WHERE url_fix = TRUE'
    )
    .then(result => result.rows);

  console.log('files', files.length);

  // NOTE: More memory killing
  const downloadMap: {[index: string]: number} = {};
  for (let d = 0; d < downloads.length; d += 1) {
    downloadMap[downloads[d].url] = d;
  }

  for (let f = 0; f < files.length; f += 1) {
    if (files[f].url in downloadMap) {
      const download = downloads[downloadMap[files[f].url]];
      if (download.state === 'new') {
        console.log(f, 'exists');
        // ignore
      } else {
        const diff =
          new Date(download.downloaded).getTime() -
          new Date(files[f].meta_modified).getTime();
        if (diff < 0) {
          console.log(f, 'update');
          await client.query(
            'INSERT INTO "Downloads" (url, state, previous, format, mimetype, download_fix) VALUES ($1, \'new\', $2, $3, $4, TRUE)',
            [
              files[f].url,
              download.id,
              standardizeFormat(files[f].format || 'unknown', files[f].url),
              mimeType(files[f].url),
            ]
          );
        } else {
          console.log(f, 'exists old');
        }
      }
    } else {
      console.log(f, 'new');
      await client.query(
        'INSERT INTO "Downloads" (url, state, format, mimetype, download_fix) VALUES ($1, \'new\', $2, $3, TRUE)',
        [
          files[f].url,
          standardizeFormat(files[f].format || 'unknown', files[f].url),
          mimeType(files[f].url),
        ]
      );
    }
  }
};
