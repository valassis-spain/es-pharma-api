const {Router} = require('express');
const {logger} = require('../config');
const router = Router();

const pointOfSaleService = require('../services/pointOfSaleService').create();

// const {verifyAccesToken} = require('../lib/jwt');
const {issueAccessToken} = require('../lib/jwt');

// get Delegado's points of sale or Point of Sale details
router.post('/', async function(req, res) {
  logger.info('Consulta Puntos de Venta');

  // const {origin} = req.body;
  let {idDelegado, idPos} = req.body;
  const token = req.pharmaApiAccessToken;

  let pointOfSale;

  // by default, point of sale is linked to user
  let isUserPosLinked = {code: 1, message: 'value by default'};

  if (idDelegado) {
    logger.info(`Delegado by parameter: [${idDelegado}]`);
  }
  else {
    idDelegado = token.idUser;
    logger.info(`Delegado by token: [${token.idUser}]`);
  }

  if (idPos) {
    logger.info(`Point of Sale by parameter: [${idPos}]`);
    isUserPosLinked = await pointOfSaleService.isUserPosLinked(token, idDelegado, idPos);

    if (isUserPosLinked.code > 0) {
      pointOfSale = await pointOfSaleService.getPointOfSale(token, idPos);
    }
    else {
      logger.error(`User not authorized [${idPos} by ${idDelegado}]`);

      res.status(401).json(isUserPosLinked);
    }
    // await getPOSDelegado(idDelegado ? idDelegado : token.idUser, idPos, token, res, origin);
  }
  else {
    // get all Pdv linked to user
    pointOfSale = await pointOfSaleService.getPointOfSaleByDelegado(token, idDelegado);
  }

  logger.info('end find');

  res.status(200).json({pointOfSale: pointOfSale, accessToken: issueAccessToken(token)});
});

router.post('/posPromotions', async function(req, res) {
  logger.info('Consulta Promociones Puntos de Venta');

  // const {origin} = req.body;
  // const {idDelegado} = req.body;
  const {idPos} = req.body;
  const {idManufacturer} = req.body;
  const token = req.pharmaApiAccessToken;

  const mappingPromotions = await pointOfSaleService.getPromotions(token, idManufacturer, idPos);

  logger.info('end posPromotions');

  res.status(200).json({promotions: mappingPromotions, accessToken: issueAccessToken(token)});
});

module.exports = router;
