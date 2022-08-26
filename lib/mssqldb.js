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
    .query(query).catch((reason) => console.log(reason))
    .then((result) => {
      if (result.recordset) {
        result.recordset.forEach(function(record, index, array) {
          mapping.push(record);
        });
      }
    });

  return mapping;
};

mssqlDb.prototype.registerAudit = async function(values = {}) {
  const query = 'insert into AUDIT (CHANGED_BY, EVENT_DATE, EVENT_NAME, EVENT_TYPE, TABLE_NAME, ROW_ID, DATA) ' +
    `values (${values.user_id},current_timestamp,'${values.eventName}','${values.eventType}','${values.tableName}',${values.rowId},'${values.data}')`;

  try {
    await this.launchQuery('transaction', query);
  }
  catch (e) {
    logger.error(e.message);
    logger.error(e.stack);
  }
};

mssqlDb.prototype.registerActivity = async function(values = {}) {
  const query = `insert into TRACKING (ID_POS, dTime, sAction, sOrigin, ID_USER) values (${values.idPos},current_timestamp,'${values.action}','${values.origin}',${values.user_id})`;

  try {
    await this.launchQuery('transaction', query);

    await this.registerAudit({
      user_id: values.user_id,
      eventName: 'register Activity',
      eventType: 'INSERT',
      tableName: 'TRACKING',
      rowId: '(select max(idTracking) from tracking)',
      data: ''
    });
  }
  catch (e) {
    logger.error(e.message);
    logger.error(e.stack);
  }
};

mssqlDb.prototype.memberOf = async function(origin, username) {
  // get user groups
  const mappingGroups = await this.launchQuery('transaction', `select g.sGroupCode rol
from users us
    left join USER_GROUPS ug on us.idUser = ug.idUser
    left join GROUPS g on ug.idGroup = g.idGroup
where us.sUsername = '${username}'`);

  const memberOf = {
    user: false,
    admin: false,
    delegado: false,
    supervisor: false,
    roles: mappingGroups
  };

  for (const rol of mappingGroups) {
    switch (rol.rol) {
      case 'ROLE_USER':
        memberOf.user = true;
        break;

      case 'ROLE_ADMIN': {
        memberOf.admin = true;
        break;
      }

      case 'ROLE_DELEGADO': {
        memberOf.delegado = true;
        break;
      }

      case 'ROLE_SUPERVISOR': {
        memberOf.supervisor = true;
        break;
      }
    }
  }

  return memberOf;
};

exports.mssqlDb = mssqlDb;

exports.create = function() {
  return new mssqlDb();
};
