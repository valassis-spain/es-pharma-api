const {logger} = require('../config');
// const {issueAccessToken} = require('../lib/jwt');
const mssqlDb = require('../lib/mssqldb').create();

const toolService = function() {
};

toolService.prototype.registerAudit = async function(values = {}) {
  const query = 'insert into AUDIT (CHANGED_BY, EVENT_DATE, EVENT_NAME, EVENT_TYPE, TABLE_NAME, ROW_ID, DATA) ' +
    `values (${values.user_id},current_timestamp,'${values.eventName}','${values.eventType}','${values.tableName}',${values.rowId},'${values.data}')`;

  try {
    await mssqlDb.launchQuery('transaction', query);
  }
  catch (e) {
    logger.error(e.message);
    logger.error(e.stack);
  }
};

toolService.prototype.registerActivity = async function(values = {}) {
  const query = `insert into TRACKING (ID_POS, dTime, sAction, sOrigin, ID_USER) values (${values.idPos},current_timestamp,'${values.action}','${values.origin}',${values.user_id})`;

  try {
    await mssqlDb.launchQuery('transaction', query);

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

exports.toolService = toolService;

exports.create = function() {
  return new toolService();
};
