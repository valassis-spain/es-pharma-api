const {Router} = require('express');
const {logger} = require('../config');
const {verifyAccesToken, issueAccessToken} = require("../lib/jwt");
const toolService = require("../services/toolService").create();
const userService = require("../services/userService").create();
const mssqlDb = require('../lib/mssqldb').create();

const router = Router();

router.get('/read', async function(req, res, next) {
  logger.debug('Get User');

  const {origin} = req.body;
  const token = req.pharmaApiAccessToken;
  const {idUser} = req.query

  try {
    let mappingUser = userService.getUserById(token.idUser)

    if (mappingUser.length !== 1) {
      toolService.registerAudit({
        user_id: token.idUser,
        eventName: 'Read User Not Found',
        eventType: 'READ',
        tableName: 'USERS',
        rowId: token.idUser,
        data: token.sub
      });

      logger.error(`User Not found [${mappingUser.length} of ${token.idUser}]`);

      res.status(404).json({error: 'POS not found'});
    }

    toolService.registerActivity({
      user_id: token.idUser,
      idPos: token.idPos,
      action: 'Consulta Usuario',
      origin: origin
    });

    logger.info(`User read successfully: ${token.idUser}`);
    res.json({user: mappingUser[0], accessToken: issueAccessToken(token)});
  }
  catch (e) {
    logger.error(e.message);
    logger.error(e.stack);

    res.status(500).json({error: e.message});
  }

});
module.exports = router;
