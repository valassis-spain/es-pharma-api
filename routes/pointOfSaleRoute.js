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

  try {
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
  }
  catch (e) {
    logger.error(e.message);
    logger.error(e.stack);

    res.status(500).json({error: e.message});
  }
});

router.post('/posInfo', async function(req, res) {
  logger.info('Consulta Detalles de Punto de Venta');

  const {idPos} = req.body;
  const {idManufacturer} = req.body;
  const token = req.pharmaApiAccessToken;
  let errors

  try {
    const mappginPos = await pointOfSaleService.getPointOfSaleDetails(token, idManufacturer, idPos);

    if ( mappginPos.length === 0 ) {
      errors = true;
      res.status(404).json({error: 'Point of Sale not found.'});
    }

    if ( ! errors ) {
      const mappingPromotions = await pointOfSaleService.getPromotions(token, idManufacturer, idPos);

      mappginPos[0].promotions = mappingPromotions;

      logger.info('end pos details');

      res.status(200).json({pointOfSale: mappginPos[0], accessToken: issueAccessToken(token)});
    }
  }
  catch (e) {
    logger.error(e.message);
    logger.error(e.stack);

    res.status(500).json({error: e.message});
  }
});

router.post('/posPromotions', async function(req, res) {
  logger.info('Consulta Promociones Puntos de Venta');

  // const {origin} = req.body;
  // const {idDelegado} = req.body;
  const {idPos} = req.body;
  const {idManufacturer} = req.body;
  const token = req.pharmaApiAccessToken;

  try {
    const mappingPromotions = await pointOfSaleService.getPromotions(token, idManufacturer, idPos);

    logger.info('end posPromotions');

    res.status(200).json({promotions: mappingPromotions, accessToken: issueAccessToken(token)});
  }
  catch (e) {
    logger.error(e.message);
    logger.error(e.stack);

    res.status(500).json({error: e.message});
  }
});

router.post('/linkPromotion', async function(req, res) {
  logger.info('Asociar Punto de Venta a Promocion');

  const {origin} = req.body;
  const {idPos, idPromotion, limit} = req.body;
  const {idManufacturer} = req.body;
  const token = req.pharmaApiAccessToken;
  let errors = false;

  try {
    const mappginPos = await pointOfSaleService.getPointOfSaleDetails(token, idManufacturer, idPos);

    if ( mappginPos.length === 0 ) {
      errors = true;
      logger.error(`Point of sale ${idPos} not found fo manufacturer ${idManufacturer}`);
      res.status(404).json({error: 'Point of Sale not found.'});
    }

    if ( !errors ) {
      const mappingPromotions = await pointOfSaleService.getPromotions(token, idManufacturer, idPos);

      let promotion;

      for (let myPromotion of mappingPromotions) {
        if (myPromotion.ID_PROMOTION === idPromotion) promotion = myPromotion
      }

      if (!promotion) {
        res.status(404).json({error: 'Promotion not found'});
        logger.error(`Promotion ${idPromotion} is not available for Point of sale ${idPos}`);
        errors = true;
      }
      else if (promotion.id_pos) {
        res.status(400).json({error: 'Pos is linked to promotion'});
        logger.error(`Point of sale ${idPos} is linked to promotion ${idPromotion}`);
        errors = true;
      }
    }

    if (!errors) {
      const mappingLink = await pointOfSaleService.createLinkPointOfSaleToPromotion(token, idManufacturer, idPos, idPromotion, limit);

      logger.info(`Point of Sale ${idPos} liked to promotion ${idPromotion}`);
      logger.info('end linkPromotion');

      res.status(200).json({message: 'Point of Sale linked to promotion', accessToken: issueAccessToken(token)});
    }
  }
  catch (e) {
    logger.error(e.message);
    logger.error(e.stack);

    res.status(500).json({error: e.message});
  }
});

router.post('/updatelinkpromotion', async function(req, res) {
  logger.info('Actualizar asociacion Punto de Venta a Promocion');

  const {origin} = req.body;
  const {idPos, idPromotion, limit} = req.body;
  const {idManufacturer} = req.body;
  const token = req.pharmaApiAccessToken;
  let errors = false;

  try {
    const mappginPos = await pointOfSaleService.getPointOfSaleDetails(token, idManufacturer, idPos);

    if ( mappginPos.length === 0 ) {
      errors = true;
      logger.error(`Point of sale ${idPos} not found fo manufacturer ${idManufacturer}`);
      res.status(404).json({error: 'Point of Sale not found.'});
    }

    if ( !errors ) {
      const mappingPromotions = await pointOfSaleService.getPromotions(token, idManufacturer, idPos);

      let promotion;

      for (let myPromotion of mappingPromotions) {
        if (myPromotion.ID_PROMOTION === idPromotion) promotion = myPromotion
      }

      if (!promotion) {
        res.status(404).json({error: 'Promotion not found'});
        logger.error(`Promotion ${idPromotion} is not available for Point of sale ${idPos}`);
        errors = true;
      }
      else if (! promotion.id_pos) {
        res.status(400).json({error: 'Pos is not linked to promotion'});
        logger.error(`Point of sale ${idPos} is not linked to promotion ${idPromotion}`);
        errors = true;
      }
    }

    if (!errors) {
      const mappingLink = await pointOfSaleService.updateLinkPointOfSaleToPromotion(token, idManufacturer, idPos, idPromotion, limit);

      logger.info(`Update link between Point of Sale ${idPos} and promotion ${idPromotion}`);
      logger.info('end updatelinkpromotion');

      res.status(200).json({message: 'Updated link between Point of Sale and promotion', accessToken: issueAccessToken(token)});
    }
  }
  catch (e) {
    logger.error(e.message);
    logger.error(e.stack);

    res.status(500).json({error: e.message});
  }
});

module.exports = router;
