"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mimeService = exports.mimeType = exports.standardizeFormat = void 0;
const mime = require("mime-types");
const standardizeFormat = (format, url) => {
    if (format) {
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
        const synonyms = [
            ['rss', ['rss-feed']],
            ['tsv', ['tab-delimited text', 'text/tab-separated-values']],
            ['csw', ['ogc csw', 'ogc: csw', 'ogc:cs-w']],
            [
                'postgres',
                [
                    'postgis datenbank',
                    'postgis datenbanktabelle',
                    'postgis',
                    'postgresql',
                ],
            ],
            [
                'oracle',
                [
                    'oracle spatial tabelle',
                    'oracle-db',
                    'oracle-forms',
                    'oracle',
                    'orcacle-db, topobase 2013 über autodesk',
                    'orcacle-db, topobase 2016 über autodesk',
                ],
            ],
            ['dxf', ['image/vnd.dxf']],
            ['xplangml', ['xplan-gml', 'xplangml', 'xplangml3.0', 'xplanung']],
            [
                'zip',
                [
                    '.zip',
                    'application/zip',
                    'gzip compressed files',
                    'tiff (gezippt)',
                    'zip-datei',
                ],
            ],
            ['html', ['htm', 'application/html']],
            ['wcs', ['wcs_xml']],
            [
                'atom',
                [
                    'atom feed',
                    'atom implementation of pre-defined dataset download service',
                    'pre-defined atom',
                    'predefined atom',
                ],
            ],
            ['docx', ['doc', 'application/docx']],
            [
                'geojson',
                ['application/vnd.geo+json', 'json/geojson (rest webservice)'],
            ],
            [
                'csv',
                ['gezippte csv-dateien', 'commaseperatetvalue (csv)', 'csv-datei'],
            ],
            [
                'xlsx',
                [
                    'application/xlsx',
                    'excel 2010, pdf',
                    'excel listen',
                    'excel',
                    'excell',
                    'exeltabelle',
                    'vnd.ms-excel',
                    'xls format',
                    'xls',
                    'xslx',
                ],
            ],
            ['wmts', ['wmts_xml']],
            [
                'wms',
                [
                    'ogc:wms',
                    'ogc/wms',
                    'wms dienst',
                    'wms_srvc',
                    'wms_xml',
                    'wms-c',
                    'wmsc',
                ],
            ],
            [
                'wfs',
                [
                    'ogc-wfs web feature service',
                    'ogc:wfs',
                    'ogc/wfs',
                    'wfs_srvc',
                    'wfs_xml',
                    'wfs-dienst',
                    'wfs-g',
                ],
            ],
            ['jpeg', ['image/jpeg', 'image/jpg', 'jpg', 'jpeg 2000']],
            [
                'ascii',
                [
                    'arcgrid',
                    'ascii (.txt)',
                    'ascii / netcdf',
                    'ascii dateiformat',
                    'ascii txt',
                    'ascii-format zeichenkodierung utf-8',
                    'ascii-grid',
                    'ascii-text',
                    'ascii-txt',
                    'ascii, hinweis: die abgabe der digitalen daten ist kostenpflichtig.',
                    'esri grid (ascii)',
                    'esri grid oder ascii',
                    'esri-grid',
                    'xyz (ascii)',
                    'xyz-ascii',
                    'xyz',
                ],
            ],
            ['kmz', ['vnd.google-earth.kmz']],
            ['csw', ['csw-schnittstelle']],
            ['bufr', ['bufr, interner code:binary']],
            ['rest', ['rest-api']],
            ['nas', ['nas austauschformat']],
            [
                'gml',
                [
                    '[gml]',
                    'application/gml+xml; version=3.2',
                    'geographic markup language (gml)',
                    'geography markup language (gml)',
                    'gml-datei',
                    'gml, shape',
                    'gml+xml',
                    'gml2',
                    'inspire gml gemäß umsetzungsrichtlinie von 2010',
                    'inspire-gml',
                    'text/xml; subtype=gml/2.1.1',
                    'text/xml; subtype=gml/3.1.1',
                    'text/xml; subtype=gml/3.2.1',
                    'xml/gml',
                    'zipped gml',
                ],
            ],
            ['geotiff', ['geotif', '8 bit-geotiff']],
            [
                'xml',
                ['application/xml', ', xml-datei', 'xml (gem. xml-schema)', 'text/xml'],
            ],
            ['asc', ['asc, interner code:esri/arcgrid']],
            [
                'shp',
                [
                    '~.shp',
                    'ahape',
                    'application/x-shapefile',
                    'arcgis-shapefile',
                    'esri shape (arcview)',
                    'esri shape format',
                    'esri shape-datei (shp)',
                    'esri shape-file',
                    'esri shape',
                    'esri shapefile (*.shp)',
                    'esri shapefile polylinem',
                    'esri shapefile und weitere formate auf anfrage',
                    'esri shapefile',
                    'esri shapefiles',
                    'esri shp',
                    'esri-linienshape',
                    'esri-polygonshape',
                    'esri-punktshape',
                    'esri-shape-file (.shp)',
                    'esri-shape-file',
                    'esri-shape',
                    'esri-shapefile',
                    'gezippte shape',
                    'shape - polyline',
                    'shape (.shp)',
                    'shape (esri)',
                    'shape (fläche)',
                    'shape (shp)',
                    'shape datei (zip-komprimiert)',
                    'shape file',
                    'shape-datei (shp)',
                    'shape-datei',
                    'shape-file',
                    'shape-files',
                    'shape',
                    'shapefile (*.shp)',
                    'shapefile (gezippt)',
                    'shapefile, shp',
                    'shapefile',
                    'shapefiles (punkt und fläche)',
                    'shapefiles',
                    'shp als zip',
                ],
            ],
            [
                'citygml',
                [
                    'adv-citygml',
                    'city gml',
                    'citygml bzw. 3d-pdf',
                    'citygml, 3d-shape, obj, dxf, mdb multipatch',
                    'citygml, esri-shape',
                    'citygml, kml',
                ],
            ],
            [
                'filegeodatabase',
                [
                    ': filebased geodatabase (feature class)',
                    'arcgis geodatabase feature class',
                    'arcgis geodatabase raster dataset',
                    'esri file geodatabase',
                    'esri file-geodatabase',
                    'esri filegeodatabase',
                    'esri gdb',
                    'esri geodatabaseformate (*.mdb, *gdb)',
                    'esri personal geodatabase',
                    'esrigdb',
                    'feature-class in file-geodatabase',
                    'feature-dataset in file-geodatabase',
                    'fgdb (esri)',
                    'fgdb',
                    'file geodatabase',
                    'file-geodadabase',
                    'file-geodatabase',
                    'filebased geodatabase (feature class)',
                    'filebased geodatabase (rasterkatalog)',
                    'filegdb-featureclass',
                    'filegeodatabase',
                    'filegeodb',
                ],
            ],
            ['gpkg', ['ogc geopackage', 'geopackage']],
            ['access', ['ms-access', 'ms access datenbank']],
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
        if (format.indexOf('gml application schema') >= 0 ||
            format.indexOf('gmlgeoanwendung schema') >= 0) {
            format = 'gml';
        }
    }
    if (url) {
        // overrules all
        const urlFormat = (0, exports.mimeService)(url);
        if (urlFormat) {
            format = urlFormat;
        }
    }
    return format;
};
exports.standardizeFormat = standardizeFormat;
const mimeType = (name) => {
    return mime.lookup(name).toString();
};
exports.mimeType = mimeType;
const mimeService = (url) => {
    let re = null;
    if (!url) {
        return null;
    }
    if (url.toLowerCase().match(/(\?|&|;)service=wms/g)) {
        re = 'wms';
    }
    else if (url.toLowerCase().match(/(\?|&|;)service=wfs/g)) {
        re = 'wfs';
    }
    else if (url.toLowerCase().match(/(\?|&|;)service=wmts/g)) {
        re = 'wmts';
    }
    return re;
};
exports.mimeService = mimeService;
//# sourceMappingURL=format.js.map