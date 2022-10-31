const {Router} = require('express');
const {logger} = require('../config');
const {verifyAccesToken} = require('../lib/jwt');

const toolService = require('../services/toolService').create();

const router = Router();

router.all('/', verifyAccesToken, async function(req, res, next) {
  logger.debug('Router Index');

  const token = req.pharmaApiAccessToken;

  if (req.pharmaApiError) {
    await toolService.registerAudit({
      user_id: 52,
      eventName: req.pharmaApiError.name,
      eventType: 'READ',
      tableName: 'USERS',
      rowId: 0,
      data: req.pharmaApiError.message
    });

    res.status(401).json({error: req.pharmaApiError.name});
  }
  else {
    await toolService.registerAudit({
      user_id: token.idUser,
      eventName: 'Access Token valid',
      eventType: 'READ',
      tableName: 'USERS',
      rowId: token.idUser,
      data: token.sub
    });

    next();
  }
});

module.exports = router;
