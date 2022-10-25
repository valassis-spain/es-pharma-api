const {logger} = require('../config');
// const {issueAccessToken} = require('../lib/jwt');
const mssqlDb = require('../lib/mssqldb').create();
const toolService = require('../services/toolService').create();

const deviceService = function() {
};

deviceService.prototype.addDevice = async function(token, idPos, params) {
  const response = {};
  const query = 'insert into dbo.DEVICES (ID_POS, DEVICE_ID, DEVICE_MODEL, DEVICE_TOKEN, SO, SO_VERSION, APP_NAME, APP_VERSION, CREATED_AT, UPDATED_AT, DEVICE_BRAND) ' +
    'values (@idPos, @deviceId, @deviceModel, @deviceToken, @so, @soVersion, @appName, @appVersion, current_timestamp, current_timestamp, @deviceBrand)';

  try {
    await mssqlDb.launchPreparedQuery('transaction', query, params);

    toolService.registerAudit({
      user_id: token.idUser,
      eventName: 'add new Device',
      eventType: 'INSERT',
      tableName: 'DEVICE',
      rowId: idPos,
      data: ''
    });

    logger.info('Device added successfully');
    response.message = 'Device added successfully';
  }
  catch (e) {
    logger.error(e.message);
    logger.error(e.stack);

    response.error = e.message;
  }

  return response;
};

exports.deviceService = deviceService;

exports.create = function() {
  return new deviceService();
};
