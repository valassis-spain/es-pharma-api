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
      logger.error(`SQL ERROR ${reason}`)
      throw new Error(reason);
    });

  return mapping;
};


exports.mssqlDb = mssqlDb;

exports.create = function() {
  return new mssqlDb();
};
