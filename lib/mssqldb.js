const sql = require('mssql');

const mssqlDb = function() {
  this._sqlConfig = require("../config").sqlConfig;
  this._logger = require("../config").logger
  this._pool = null
};

mssqlDb.prototype.launchQuery = async function(transaction, query) {

  if (!this._pool)
    this._pool = await sql.connect(this._sqlConfig).catch(err => console.log('ERROR:' + err));

  let mapping = [];

  await this._pool.request()
    .query(query).catch(reason => console.log(reason))
    .then(result => {
      if (result.recordset) {
        result.recordset.forEach(function (record, index, array) {
          mapping.push(record);
        })
      }
    });

  return mapping;
}


exports.mssqlDb = mssqlDb;

exports.create = function() {
  return new mssqlDb();
};
