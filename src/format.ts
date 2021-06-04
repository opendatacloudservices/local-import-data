import * as mime from 'mime-types';

export const standardizeFormat = (format: string): string => {
  // clean string
  format = format.toLocaleLowerCase().trim();

  // remove format meta urls
  const removal = [
    'http://publications.europa.eu/resource/authority/file-type/',
    'http://publications.europa.eu/mdr/resource/authority/file-type/',
    'https://daten.berlin.de/schema/dist-format/',
    'https://www.iana.org/assignments/media-types/text/',
    'https://www.iana.org/assignments/media-types/application/',
    'https://www.iana.org/assignments/media-types/image/',
    'application/vnd.ogc.',
  ];

  removal.forEach(r => {
    format = format.replace(r, '');
  });

  // remove leading point
  if (format.indexOf('.') === 0) {
    format = format.substr(1);
  }

  // replace synonyms
  const synonyms: {
    0: string;
    1: string[];
  }[] = [
    ['rss', ['rss-feed']],
    ['dxf', ['image/vnd.dxf']],
    ['zip', ['zip-datei', 'tiff (gezippt)']],
    ['html', ['htm', 'application/html']],
    ['wcs', ['wcs_xml']],
    ['atom', ['atom feed', 'predefined atom', 'pre-defined atom']],
    ['docx', ['doc', 'application/docx']],
    ['geojson', ['application/vnd.geo+json']],
    ['csv', ['gezippte csv-dateien']],
    ['xlsx', ['xls', 'vnd.ms-excel', 'xslx', 'application/xlsx']],
    ['wmts', ['wmts_xml']],
    [
      'wms',
      [
        'wms_srvc',
        'wms dienst',
        'wms_xml',
        'ogc:wms',
        'wms-c',
        'ogc/wms',
        'wmsc',
      ],
    ],
    ['wfs', ['wfs_xml', 'wfs_srvc', 'wfs-g', 'ogc:wfs', 'ogc/wfs']],
    ['jpeg', ['image/jpeg', 'image/jpg', 'jpg', 'jpeg 2000']],
    ['ascii', ['ascii-grid', 'ascii-text']],
    ['kmz', ['vnd.google-earth.kmz']],
    ['rest', ['rest-api']],
    ['nas', ['nas austauschformat']],
    [
      'gml',
      [
        '[gml]',
        'geography markup language (gml)',
        'geographic markup language (gml)',
        'inspire-gml',
        'gml+xml',
      ],
    ],
    ['geotiff', ['geotif', '8 bit-geotiff']],
    [
      'shp',
      [
        'shapefile',
        'shape',
        'application/x-shapefile',
        'shapefiles',
        'shape-file',
        'shape-files',
        'shape (esri)',
        'shape file',
        'esri shape',
        'esri-shapefile',
        'shape-datei',
        'esri shape-file',
        'shapefile (gezippt)',
        'gezippte shape',
        'shp als zip',
        'esri shapefile polylinem',
      ],
    ],
  ];

  synonyms.forEach(synonym => {
    synonym[1].forEach(s => {
      if (format === s) {
        format = synonym[0];
      }
    });
  });

  if (format.indexOf(',') > -1) {
    format = '__multi__';
  }

  return format;
};

export const mimeType = (name: string): string => {
  return mime.lookup(name).toString();
};
