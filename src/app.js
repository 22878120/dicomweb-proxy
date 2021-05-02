const config = require('config');
const shell = require('shelljs');
const fs = require('fs');
const path = require('path');
const fastify = require('fastify')({ logger: false });

// make sure default directories exist
shell.mkdir('-p', config.get('logDir'));
shell.mkdir('-p', './data');

const utils = require('./utils.js');

fastify.register(require('fastify-static'), {
  root: path.join(__dirname, '../public'),
});

fastify.register(require('fastify-cors'), {});

fastify.register(require('fastify-sensible'));

fastify.register(require('fastify-helmet'), { contentSecurityPolicy: false });

fastify.register(require('fastify-compress'), { global: true });

const logger = utils.getLogger();

// log exceptions
process.on('uncaughtException', async (err) => {
  await logger.error('uncaught exception received:');
  await logger.error(err.stack);
});

//------------------------------------------------------------------

process.on('SIGINT', async () => {
  await logger.info('shutting down web server...');
  fastify.close().then(async () => {
    await logger.info('webserver shutdown successfully');
  }, (err) => {
    logger.error('webserver shutdown failed', err);
  })
  if (!config.get('useCget')) {
    await logger.info('shutting down DICOM SCP server...');
    await utils.shutdown();
  }
});

//------------------------------------------------------------------

fastify.get('/viewer/rs/studies', async (req, reply) => {
  const tags = utils.studyLevelTags();
  const json = await utils.doFind('STUDY', req.query, tags);
  reply.send(json);
});

//------------------------------------------------------------------

fastify.get('/rs/studies', async (req, reply) => {
  const tags = utils.studyLevelTags();
  const json = await utils.doFind('STUDY', req.query, tags);
  reply.send(json);
});

//------------------------------------------------------------------

fastify.get('/viewer/rs/studies/:studyInstanceUid/metadata', async (req, reply) => {
  const { query } = req;
  query.StudyInstanceUID = req.params.studyInstanceUid;
  const tags = utils.seriesLevelTags();
  const json = await utils.doFind('SERIES', query, tags);
  reply.send(json);
});

//------------------------------------------------------------------

fastify.get('/viewer/rs/studies/:studyInstanceUid/series', async (req, reply) => {
  const tags = utils.seriesLevelTags();
  const { query } = req;
  query.StudyInstanceUID = req.params.studyInstanceUid;

  const json = await utils.doFind('SERIES', query, tags);
  reply.send(json);
});

//------------------------------------------------------------------

fastify.get('/viewer/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances', async (req, reply) => {
  const tags = utils.imageLevelTags();
  const { query } = req;
  query.StudyInstanceUID = req.params.studyInstanceUid;
  query.SeriesInstanceUID = req.params.seriesInstanceUid;

  const json = await utils.doFind('IMAGE', query, tags);
  reply.send(json);
});

//------------------------------------------------------------------

fastify.get('/viewer/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/metadata', async (req, reply) => {
  const tags = utils.imageLevelTags();
  const { query } = req;
  query.StudyInstanceUID = req.params.studyInstanceUid;
  query.SeriesInstanceUID = req.params.seriesInstanceUid;

  const json = await utils.doFind('IMAGE', query, tags);
  reply.send(json);
});

//------------------------------------------------------------------

fastify.get('/viewer/wadouri', async (req, reply) => {
  const fetchLevel = config.get('useFetchLevel');
  const studyUid = req.query.studyUID;
  const seriesUid = req.query.seriesUID;
  const imageUid = req.query.objectUID;
  if (!studyUid || !seriesUid || !imageUid) {
    const msg = `Error missing parameters.`;
    logger.error(msg);
    reply.code(500);
    reply.send(msg);
    return;
  }
  const storagePath = config.get('storagePath');
  const studyPath = path.join(storagePath, studyUid);
  const pathname = path.join(studyPath, imageUid);

  try {
    await utils.fileExists(pathname);
  } catch (error) {
    try {
      await utils.waitOrFetchData(studyUid, seriesUid, imageUid, fetchLevel);
    } catch (e) {
      logger.error(e);
      const msg = `fetch failed`;
      reply.code(500);
      reply.send(msg);
      return;
    }
  }

  try {
    await utils.fileExists(pathname);
  } catch (error) {
    logger.error(error);
    const msg = `file not found ${pathname}`;
    reply.code(500);
    reply.send(msg);
    return;
  }

  try {
    await utils.compressFile(pathname, studyPath);
  } catch (error) {
    logger.error(error);
    const msg = `failed to compress ${pathname}`;
    reply.code(500);
    reply.send(msg);
    return;
  }

  // if the file is found, set Content-type and send data
  reply.header('Content-Type', 'application/dicom');

  // read file from file system
  fs.readFile(pathname, (err, data) => {
    if (err) {
      const msg = `Error getting the file: ${err}.`;
      logger.error(msg);
      reply.setCode(500);
      reply.send(msg);
    }
    reply.send(data);
  });
});

//------------------------------------------------------------------

const port = config.get('webserverPort');
logger.info('starting...');
fastify.listen(port, async (err, address) => {
  if (err) {
    await logger.error(err, address);
    process.exit(1);
  }
  logger.info(`web-server listening on port: ${port}`);

  await utils.init();

  // if not using c-get, start our scp
  if (!config.get('useCget')) {
    utils.startScp();
  }
  utils.sendEcho();
});

//------------------------------------------------------------------
