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
  const {
    idManufacturer,
    idPos,
    quicksearch,
    pendingPaymentsLast3Months,
    pendingPaymentsLastMonth,
    invalidTicketsLast3Months,
    invalidTicketsLastMonth
  } = req.body;

  let {idDelegado} = req.body;

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

  if (!idDelegado) idDelegado = token.idUser;

  pointOfSale = await pointOfSaleService.getListPointOfSaleByDelegado(token, {
    idManufacturer,
    idDelegado,
    idPos,
    quicksearch,
    pendingPaymentsLast3Months,
    pendingPaymentsLastMonth,
    invalidTicketsLast3Months,
    invalidTicketsLastMonth
  });
  // }

  logger.info('end find');

  res.status(200).json({pointOfSale: pointOfSale, accessToken: issueAccessToken(token)});
});

router.post('/posInfo', async function(req, res) {
  logger.info('Consulta Detalles de Punto de Venta');

  const {idPos} = req.body;
  const {idManufacturer} = req.body;
  const token = req.pharmaApiAccessToken;

  const mappginPos = await pointOfSaleService.getPointOfSaleDetails(token, idManufacturer, idPos);

  const mappingPromotions = await pointOfSaleService.getPromotions(token, idManufacturer, idPos);

  mappginPos[0].promotions = mappingPromotions;

  logger.info('end pos details');

  res.status(200).json({pointOfSale: mappginPos[0], accessToken: issueAccessToken(token)});
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
