const {logger} = require('../config');
// const {issueAccessToken} = require('../lib/jwt');
const mssqlDb = require('../lib/mssqldb').create();

const deviceService = function() {
};

deviceService.prototype.addDevice = async function(token, idPos) {
  const response = {};
  const query = 'insert into dbo.DEVICES (ID_POS, DEVICE_ID, DEVICE_MODEL, DEVICE_TOKEN, SO, SO_VERSION, APP_NAME, APP_VERSION, CREATED_AT, UPDATED_AT, DEVICE_BRAND) ' +
    `values (@idPos, @deviceId, @deviceModel, @deviceToken, @so, @soVersion, @appName, @appVersion, current_timestamp, current_timestamp, @deviceBrand)`;

  try {
    await mssqlDb.launchPreparedQuery('transaction', query, {
      idPos: idPos,
      appName:"es.valassis.valassispharma",
      appVersion:"2.5.5",
      deviceBrand:"samsung",
      deviceId:"68c6b89e394e183d",
      deviceModel:"SM-G985F",
      deviceToken:"ewq4ufggRVOv7-WLZd7kIb:APA91bE-9MqcjVtTydXDr1yGQ7gcnEuwmkUkTl43szKcAcd3mQnvdS4AUyFgbPb6232KFEuikRK1Dhm6LCaJ-522WLdgmwehyWD2m1flPtoYjwaxjKooPrTjHmeedsouvpTwYr6FMAYt",
      so:"Android",
      soVersion:"12",
    });

    response.message='Device added successfully';
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
