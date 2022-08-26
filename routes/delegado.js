const {Router} = require('express');
const {logger} = require('../config');
const router = Router();
const mssqlDb = require('../lib/mssqldb').create();

const {issueAccessToken, verifyAccesToken} = require('../lib/jwt');

router.all('/*', verifyAccesToken, function(req, res, next) {
  logger.debug('Router Delegados');

  const token = req.pharmaApiAccessToken;

  if (req.pharmaApiError) {
    mssqlDb.registerAudit({
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
    mssqlDb.registerAudit({
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

router.get('/:idDelegado', async function(req, res) {
  logger.info('Consulta delegado');

  const {origin} = req.body;
  const {idDelegado} = req.params;
  const token = req.pharmaApiAccessToken;

  try {
    const mappingDelegado = await mssqlDb.launchQuery('transaction', `select id, id_user, name,email,phone,address,city,zip_code,state,country,removed_at from  USER_DETAIL ud where ud.id_user = ${idDelegado}`);

    if (mappingDelegado.length !== 1) {
      mssqlDb.registerAudit({
        user_id: token.idUser,
        eventName: 'Read User Detail Not Found',
        eventType: 'READ',
        tableName: 'USER_DETAIL',
        rowId: idDelegado,
        data: token.sub
      });

      logger.error(`User Not found [${mappingDelegado.length} of ${idDelegado}]`);

      res.status(404).json({error: 'User not found'});
    }

    const isMemberOf = await mssqlDb.memberOf(origin, token.sub);

    if (isMemberOf.supervisor) {
      const mappingSubs = await mssqlDb.launchQuery('transaction', `select ud.id_user,ud.name,ud.email,ud.phone,ud.removed_at from SUPERVISOR sup
left join user_detail ud on ud.id_user = sup.id_user 
where sup.id_supervisor = ${token.idUser}`);

      mappingDelegado[0].delegados = mappingSubs;
    }

    // search my PdVs
    const mappingPdv = await mssqlDb.launchQuery('transaction', `select id_pos,name,email,phone,contact_person,category
from PS_DIM_POINT_OF_SALE
where ID_POS in (select distinct(id_pos)
                 from USER_POS up
                 where up.id_user = ${token.idUser}
                    or up.ID_USER in (select SUPERVISOR.ID_USER
                                      from SUPERVISOR
                                      where ID_SUPERVISOR = ${token.idUser}))`);

    mappingDelegado[0].pdv = mappingPdv;

    mssqlDb.registerAudit({
      user_id: token.idUser,
      eventName: 'Read User Detail',
      eventType: 'READ',
      tableName: 'USER_DETAIL',
      rowId: idDelegado,
      data: token.sub
    });

    mssqlDb.registerActivity({
      user_id: token.idUser,
      idPos: token.idPos,
      action: 'Consulta Detalle Delegado',
      origin: origin
    });

    mappingDelegado[0].accessToken = issueAccessToken(token);
    res.json(mappingDelegado[0]);
  }
  catch (e) {
    logger.error(e.message);
    logger.error(e.stack);

    res.status(500).json({error: e.message});
  }
});

router.put('/', async function(req, res) {
  logger.info('Update delegado (fase 2)');

  const {origin, name, phone, address, city, zipCode, state, country} = req.body;
  const token = req.pharmaApiAccessToken;

  try {
    await mssqlDb.launchQuery('transaction', `update USER_DETAIL set 
${name ? 'NAME=\'' + name + '\',' : ''}
${phone ? 'PHONE=\'' + phone + '\',' : ''}
${address ? 'ADDRESS=\'' + address + '\',' : ''}
${city ? 'CITY=\'' + city + '\',' : ''}
${zipCode ? 'ZIP_CODE=\'' + zipCode + '\',' : ''}
${state ? 'STATE=\'' + state + '\',' : ''}
${country ? 'COUNTRY=\'' + country + '\',' : ''}
UPDATED_AT=current_timestamp, UPDATED_BY=${token.idUser} 
where ID_USER=${token.idUser}`);

    mssqlDb.registerAudit({
      user_id: token.idUser,
      eventName: 'Update User Detail',
      eventType: 'UPDATE',
      tableName: 'USER_DETAIL',
      rowId: `(select id from user_detail where ID_USER = ${token.idUser})`,
      data: token.sub
    });

    mssqlDb.registerActivity({
      user_id: token.idUser,
      idPos: token.idPos,
      action: 'Actualizar Detalles Delegado',
      origin: origin
    });

    logger.info(`User Details updated successfully: ${token.idUser}`);
    res.json({accessToken: issueAccessToken(token)});
  }
  catch (e) {
    logger.error(e.message);
    logger.error(e.stack);

    res.status(500).json({error: e.message});
  }
});

router.post('/:idDelegado', async function(req, res) {
  const {idDelegado} = req.params;
  req.body.idDelegado = idDelegado;

  res.redirect(307, '/');
});

router.post('/', async function(req, res) {
  logger.info('Nuevo delegado (fase 2)');

  const {origin, name, email, phone, address, city, zipCode, state, country} = req.body;
  const token = req.pharmaApiAccessToken;

  try {
    await mssqlDb.launchQuery('transaction', `insert into USER_DETAIL (ID_USER, NAME, EMAIL, PHONE, ADDRESS, CITY, ZIP_CODE, STATE, COUNTRY, CREATED_AT)
values (${token.idUser},'${name}','${email ? email : token.sub}','${phone}','${address}','${city}',${zipCode ? zipCode : 0},'${state}','${country ? country : 'es'}',current_timestamp)`);

    mssqlDb.registerAudit({
      user_id: token.idUser,
      eventName: 'register New User Detail',
      eventType: 'INSERT',
      tableName: 'USER_DETAIL',
      rowId: '(select max(id) from user_detail)',
      data: token.sub
    });

    mssqlDb.registerActivity({
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

router.delete('/:idDelegado', async function(req, res) {
  logger.info('Baja delegado (fase 2)');

  const {origin} = req.body;
  const {idDelegado} = req.params;
  const token = req.pharmaApiAccessToken;

  try {
    await mssqlDb.launchQuery('transaction', `update USER_DETAIL set REMOVED_AT=current_timestamp, REMOVED_BY=${token.idUser} 
where ID_USER=${idDelegado}`);

    mssqlDb.registerAudit({
      user_id: token.idUser,
      eventName: 'Disabled User Detail',
      eventType: 'UPDATE',
      tableName: 'USER_DETAIL',
      rowId: `(select id from user_detail where ID_USER = ${idDelegado})`,
      data: token.sub
    });

    await mssqlDb.launchQuery('transaction', `update USERS set ENABLED=0, ACCOUNT_LOCKED=1 
where idUser=${idDelegado}`);

    mssqlDb.registerAudit({
      user_id: token.idUser,
      eventName: 'Disabled User Account',
      eventType: 'UPDATE',
      tableName: 'USERS',
      rowId: idDelegado,
      data: token.sub
    });

    mssqlDb.registerActivity({
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

module.exports = router;
