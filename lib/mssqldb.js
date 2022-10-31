const sql = require('mssql');
const {logger} = require('../config');

const mssqlDb = function() {
  this._sqlConfig = require('../config').sqlConfig;
  this._logger = require('../config').logger;
  this._pool = null;
};

const eventRead = 'READ';
const eventInsert = 'INSERT';
const eventUpdate = 'UPDATE';
const eventDelete = 'DELETE';

mssqlDb.prototype.eventTypes = [eventRead, eventInsert, eventUpdate, eventDelete];

mssqlDb.prototype.launchQuery = async function(transaction, query) {
  if (!this._pool)
    this._pool = await sql.connect(this._sqlConfig).catch((err) => logger.error('ERROR:' + err));

  const mapping = [];

  logger.debug(`[launchQuery] query . [${query}]`);

  await this._pool.request()
    .query(query)
    .then((result) => {
      if (result && result.recordset) {
        result.recordset.forEach(function(record, index, array) {
          mapping.push(record);
        });
      }
    })
    .catch((reason) => {
      logger.error(`SQL ERROR ${reason}`);
      throw new Error(reason);
    });

  return mapping;
};

mssqlDb.prototype.launchPreparedQuery = async function(transaction, query, params) {
  const mapping = [];
  let request;

  try {
    if (!this._pool)
      this._pool = await sql.connect(this._sqlConfig).catch((err) => logger.error('ERROR:' + err));


    logger.debug(`[launchPreparedQuery] query . [${query}]`);

    request = this._pool.request();
  }
  catch (e) {
    logger.error(e.message);
    logger.error(e.stack);
    throw new Error(e.message);
  }

  if (params) {
    for (const paramKey of Object.keys(params)) {
      request.input(paramKey, params[paramKey]);
      logger.debug(`[launchPreparedQuery] added param . [${paramKey} = ${params[paramKey]}]`);
    }
  }

  await request.query(query).then((result) => {
    if (result && result.recordset) {
      result.recordset.forEach(function(record, index, array) {
        mapping.push(record);
      });
    }
  })
    .catch((reason) => {
      logger.error(`SQL ERROR ${reason}`);
      throw new Error(reason);
    });

  return mapping;
};

exports.mssqlDb = mssqlDb;

exports.create = function() {
  return new mssqlDb();
};
