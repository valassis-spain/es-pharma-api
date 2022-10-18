const axios = require('axios');
const https = require('https');
const {logger} = require('../config');

const bridgeService = function() {
};

bridgeService.prototype.userview = async function(token, idPos, idPromotion) {

  let response

  const instance = axios.create({
    httpsAgent: new https.Agent({
      rejectUnauthorized: false
    }),
    headers: {'Token': process.env.BRIDGE_TOKEN, 'Secret': process.env.BRIDGE_SECRET}
  });

  await instance.get(process.env.BRIDGE_HOST + process.env.BRIDGE_PATH_USER_VIEW + '?' + (new URLSearchParams({
    id_pos: idPos,
    id_promotion: idPromotion,
    days: 1
  }))).then(resp => {

    response = resp.data;
  })
    .catch(e => {
      logger.error(`ERROR calling to bridge ${e}`)
    });

  return response;
};

exports.bridgeService = bridgeService;

exports.create = function() {
  return new bridgeService();
};
