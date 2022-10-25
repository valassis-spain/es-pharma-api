const {Router} = require('express');
const {logger} = require('../config');
const {issueAccessToken} = require('../lib/jwt');
const toolService = require('../services/toolService').create();
const deviceService = require('../services/deviceService').create();

const router = Router();

router.put('/', async function(req, res, next) {
  logger.debug('Put Device');

  const {origin, appName, appVersion, deviceBrand, deviceId, deviceModel, deviceToken, so, soVersion} = req.body;
  const token = req.pharmaApiAccessToken;

  logger.debug(`POST: ${JSON.stringify(req.body)}`);
  logger.debug(`GET: ${JSON.stringify(req.query)}`);

  try {
    const response = await deviceService.addDevice(token, token.idPos, {
      idPos: token.idPos,
      appName,
      appVersion,
      deviceBrand,
      deviceId,
      deviceModel,
      deviceToken,
      so,
      soVersion
    });

    if (response.error) {
      res.status(500).json({error: response.error});
    }
    else {
      toolService.registerActivity({
        user_id: token.idUser,
        idPos: token.idPos,
        action: 'Add Device Information',
        origin: origin
      });

      res.status(200).json({message: response.message, access_token: issueAccessToken(token)});
    }
  }
  catch (e) {
    logger.error(e.message);
    logger.error(e.stack);

    res.status(500).json({error: e.message});
  }
});

module.exports = router;
