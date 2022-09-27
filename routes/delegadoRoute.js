const {Router} = require('express');
const {logger} = require('../config');
const router = Router();
// const mssqlDb = require('../lib/mssqldb').create();

// Services
const delegadoService = require('../services/delegadoService').create();
const pointOfSaleService = require('../services/pointOfSaleService').create();
const userService = require('../services/userService').create();
const toolService = require('../services/toolService').create();

// Middleware
// const {verifyAccesToken} = require('../lib/jwt');
const {issueAccessToken} = require('../lib/jwt');

/*
 * El usuario por defecto será el recibido por parámetro
 * Si no se ha recibido parámetro, se usara el usuario del token
 */
const getUserInit = function(req, res, next) {
  const {idDelegado} = req.body;
  const token = req.pharmaApiAccessToken;

  if (!idDelegado)
    req.body.idDelegado = token.idUser;

  next();
};

const getUser = async function(req, res, next) {
  const {idDelegado} = req.body;
  const token = req.pharmaApiAccessToken;

  try {
    const mappingUser = await userService.getUserById(token, idDelegado);

    if (mappingUser.length !== 1) {
      toolService.registerAudit({
        user_id: token.idUser,
        eventName: 'Read User Not Found',
        eventType: 'READ',
        tableName: 'USERS',
        rowId: idDelegado,
        data: token.sub
      });

      logger.error(`User Not found [${mappingUser.length} of ${idDelegado}]`);

      res.status(404).json({error: 'User not found'});
    }
    else {
      req.locals = {mappingUser: mappingUser[0]};
      next();
    }
  }
  catch (e) {
    logger.error(e.message);
    logger.error(e.stack);

    res.status(500).json({error: e.message});
  }
};

const getDelegado = async function(req, res, next) {
  const {idDelegado} = req.body;
  const token = req.pharmaApiAccessToken;

  try {
    const mappingDelegado = await userService.getUserDetailsById(token, idDelegado);

    if (mappingDelegado.length !== 1) {
      toolService.registerAudit({
        user_id: token.idUser,
        eventName: 'Read User Detail Not Found',
        eventType: 'READ',
        tableName: 'USER_DETAIL',
        rowId: idDelegado,
        data: token.sub
      });

      logger.error(`User Details Not found [${mappingDelegado.length} of ${idDelegado}]`);

      // res.status(404).json({error: 'User Details not found'});
      req.locals.mappingDelegado = {};
      next();
    }
    else {
      req.locals.mappingDelegado = mappingDelegado[0];
      next();
    }
  }
  catch (e) {
    logger.error(e.message);
    logger.error(e.stack);

    res.status(500).json({error: e.message});
  }
};

const verifyAuthorization = function(req, res, next) {
  const {idDelegado} = req.body;
  const token = req.pharmaApiAccessToken;
  const mappingUser = req.locals.mappingUser;

  if (parseInt(idDelegado) !== token.idUser && token.idUser !== mappingUser.ID_SUPERVISOR) {
    toolService.registerAudit({
      user_id: token.idUser,
      eventName: 'Read User Not Authorized',
      eventType: 'READ',
      tableName: 'USERS',
      rowId: idDelegado,
      data: token.sub
    });

    logger.error(`User Not authorized [${token.idUser} of read ${idDelegado}]`);

    res.status(401).json({error: 'Unauthorized'});
  }
  else {
    next();
  }
};

router.post('/read', getUserInit, getUser, verifyAuthorization, getDelegado, async function(req, res, next) {
  logger.info('Consulta delegado');

  const {origin, page} = req.body;
  // let {idDelegado} = req.body;
  const token = req.pharmaApiAccessToken;

  const rowsOfPage = parseInt(process.env.SQL_FETCH_ROWS);

  try {
    // get my ROLES
    const isMemberOf = await userService.memberOf(token, origin, token.sub);

    // if I am a SUPERVISOR, get my delegados
    if (isMemberOf.ROLE_SUPERVISOR)
      req.locals.mappingDelegado.delegados = await delegadoService.getMyDelegs(token, token.idUser);

    // search my PdVs
    req.locals.mappingDelegado.pos = {
      page: (page ? page : 0),
      rowsOfPage: rowsOfPage,
      totalRows: await pointOfSaleService.getRowsPointOfSaleByDelegado(token, token.idUser),
      pointsOfSale: await pointOfSaleService.getPointOfSaleByDelegado(token, {idDelegado:token.idUser})
    };

    toolService.registerActivity({
      user_id: token.idUser,
      idPos: token.idPos,
      action: 'Consulta Detalle Delegado',
      origin: origin
    });

    req.locals.mappingDelegado.roles = isMemberOf.roles;
    req.locals.mappingDelegado.accessToken = issueAccessToken(token);

    res.json(req.locals.mappingDelegado);
  }
  catch (e) {
    logger.error(e.message);
    logger.error(e.stack);

    res.status(500).json({error: e.message});
  }
});

router.put('/update', async function(req, res) {
  logger.info('Update delegado (fase 2)');

  const {origin, name, phone, address, city, zipCode, state, country} = req.body;
  let {idDelegado} = req.body;

  const token = req.pharmaApiAccessToken;

  if (!idDelegado) idDelegado = token.idUser;

  const values = {};
  values.origin = origin;
  values.name = name;
  values.phone = phone;
  values.address = address;
  values.city = city;
  values.zipCode = zipCode;
  values.state = state;
  values.country = country;

  try {
    await userService.updateUserDetails(token, idDelegado, values);

    toolService.registerActivity({
      user_id: token.idUser,
      idPos: token.idPos,
      action: 'Actualizar Detalles Delegado',
      origin: origin
    });

    logger.info(`User Details updated successfully: ${idDelegado} by ${token.idUser}`);
    res.json({accessToken: issueAccessToken(token)});
  }
  catch (e) {
    logger.error(e.message);
    logger.error(e.stack);

    res.status(500).json({error: e.message});
  }
});

router.post('/promotions', async function(req, res) {
  logger.info('Get Promotions by manufacturer');

  const {origin, idManufacturer} = req.body;
  let {idDelegado} = req.body;
  const token = req.pharmaApiAccessToken;

  if (!idDelegado) idDelegado = token.idUser;

  try {
    const promotions = await delegadoService.getMyPromotions(token, idManufacturer);

    toolService.registerActivity({
      user_id: token.idUser,
      idPos: token.idPos,
      action: 'Consulta Promociones',
      origin: origin
    });

    res.json({promotions, accessToken: issueAccessToken(token)});
  }
  catch (e) {
    logger.error(e.message);
    logger.error(e.stack);

    res.status(500).json({error: e.message});
  }
});

// router.post('/:idDelegado', async function(req, res) {
//   const {idDelegado} = req.params;
//   req.body.idDelegado = idDelegado;
//
//   res.redirect(307, '/');
// });

router.post('/add', async function(req, res) {
  logger.info('Nuevo delegado (fase 2)');

  const {origin, name, phone, address, city, zipCode, state, country} = req.body;
  // const {email} = req.body;
  let {idDelegado} = req.body;
  const token = req.pharmaApiAccessToken;

  if (!idDelegado) idDelegado = token.idUser;

  const values = {};
  values.origin = origin;
  values.name = name;
  values.phone = phone;
  values.address = address;
  values.city = city;
  values.zipCode = zipCode;
  values.state = state;
  values.country = country;

  try {
    await userService.createUserDetails(token, idDelegado, values);

    toolService.registerActivity({
      user_id: token.idUser,
      idPos: token.idPos,
      action: 'Nuevos Detalles Delegado',
      origin: origin
    });

    res.json({accessToken: issueAccessToken(token)});
  }
  catch (e) {
    logger.error(e.message);
    logger.error(e.stack);

    res.status(500).json({error: e.message});
  }
});

router.delete('/del/:idDelegado', async function(req, res) {
  logger.info('Baja delegado (fase 2)');

  const {origin} = req.body;
  const {idDelegado} = req.params;
  const token = req.pharmaApiAccessToken;

  try {
    await userService.logicalRemove(token, idDelegado);

    await userService.disableUser(token, idDelegado);

    toolService.registerActivity({
      user_id: token.idUser,
      idPos: token.idPos,
      action: 'Baja Delegado',
      origin: origin
    });

    res.json({accessToken: issueAccessToken(token)});
  }
  catch (e) {
    logger.error(e.message);
    logger.error(e.stack);

    res.status(500).json({error: e.message});
  }
});

router.post('/linkpos', async function(req, res) {
  logger.info('Asociar Punto de Venta a Delegado');

  const {origin} = req.body;
  // const {name, email, phone, address, city, zipCode, state, country} = req.body;
  let {idDelegado, idPos} = req.body;
  const token = req.pharmaApiAccessToken;

  if (!idDelegado) idDelegado = token.idUser;

  try {
    // verify point of sale has delegado
    const posDelegados = await pointOfSaleService.getPointOfSaleDelegado(token, idPos);

    if (posDelegados.length === 0) {
      // Point of Sale don't have delegado, create link
      logger.info(`Point of sale don't have delegado [${idPos}]`);
      await pointOfSaleService.createLinkPointOfSaleToDelegado(token, idDelegado, idPos);

      toolService.registerActivity({
        user_id: token.idUser,
        idPos: idPos,
        action: 'Link POS to Delegado',
        origin: origin
      });

      res.json({accessToken: issueAccessToken(token)});
    } // end if point of sale has delegado
    else if (posDelegados[0].ID_USER === idDelegado) {
      // point of sale has delegado

      logger.info(`Point Of Sale is linked to Delegado [${idPos} with ${idDelegado}]`);
    }
    else if (posDelegados[0].ID_SUPERVISOR === token.idUser) {
      // si es del mismo supervisor y es el usuario conectado, realizar el cambio
      await pointOfSaleService.updateLinkPointOfSaleToDelegado(token, idDelegado, idPos);

      toolService.registerActivity({
        user_id: token.idUser,
        idPos: idPos,
        action: 'Update Link POS to Delegado',
        origin: origin
      });

      res.json({accessToken: issueAccessToken(token)});
    } // end point of sale has delegado of same supervisor, update
    else {
      // point of sale has Delegado and it's not the same supervisor, reject
      toolService.registerActivity({
        user_id: token.idUser,
        idPos: idPos,
        action: 'REJECT Link POS to Delegado',
        origin: origin
      });

      res.status(401).json({accessToken: issueAccessToken(token)});
    } // end poit of sale has Delegado of other supervisor
  }
  catch (e) {
    logger.error(e.message);
    logger.error(e.stack);

    res.status(500).json({error: e.message});
  }
});

module.exports = router;
