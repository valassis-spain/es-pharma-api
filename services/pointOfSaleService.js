const {logger} = require('../config');
const {issueAccessToken} = require("../lib/jwt");
const toolService = require("./toolService").create();
const mssqlDb = require('../lib/mssqldb').create();

const pointOfSaleService = function() {
};

/**
 *
 * @param token
 * @param idUser
 * @param idPos
 * @returns {Promise<{code: number, message: string}>}
 * **-3:** farmacia no es NORMAL <br>
 * **-2:** farmacia no encontrada <br>
 * **-1:** excepción <br>
 * **&nbsp;0:** farmacia **NO** asociada al usuario <br>
 * **&nbsp;1:** farmacia asociada al usuario como **DELEGADO** <br>
 * **&nbsp;2:** farmaia asociada al usuario como **SUPERVISOR** <br>
 */
pointOfSaleService.prototype.isUserPosLinked = async function(token, idUser, idPos) {
  try {
    // search my PdVs
    const mappingPdv = await mssqlDb.launchQuery('transaction', `select pos.ID_POS, pos.CATEGORY, up.ID_USER, sup.ID_SUPERVISOR
    from PS_DIM_POINT_OF_SALE pos
    left join USER_POS up on up.ID_POS = pos.ID_POS
    left join SUPERVISOR sup on sup.ID_USER = up.ID_USER or sup.ID_SUPERVISOR = up.ID_USER
    where pos.ID_POS = ${idPos}`);

    if (mappingPdv.length === 0) {
      toolService.registerAudit({
        user_id: token.idUser,
        eventName: 'Read POS Not Found',
        eventType: 'READ',
        tableName: 'PS_DIM_POINT_OF_SALE',
        rowId: idUser,
        data: idPos
      });

      logger.info(`[isUserPosLinked] Point of sale [${idPos}] not found`)

      return {code: -2, message: 'Point of Sale not found'};
    }

    toolService.registerAudit({
      user_id: idUser,
      eventName: 'Read User - Points of Sale',
      eventType: 'READ',
      tableName: 'PS_DIM_POINT_OF_SALE',
      rowId: idPos,
      data: ''
    });

    for (const relation of mappingPdv) {
      if (relation.CATEGORY !== 'NORMAL') {
        logger.info(`[isUserPosLinked] Point of sale [${idPos}] DISABLED`)

        return {code: -3, message: 'Point of sale disabled'}; // farmacia está inhabilitada
      }

      if (relation.ID_USER === idUser) {
        logger.info(`[isUserPosLinked] Point of sale [${idPos}] linked with user [${idUser}] as DELEGADO`)

        return {code: 1, message: 'Point of sale linked as DELEGADO'}; // farmacia asociada al delegado
      }

      if (relation.ID_SUPERVISOR === idUser) {
        logger.info(`[isUserPosLinked] Point of sale [${idPos}] linked with user [${idUser}] as SUPERVISOR`)

        return {code: 2, message: 'Point of sale linked as SUPERVISOR'}; // farmacia asociada a un delegado bajo mi supervision
      }
    } // end for relations
    logger.info(`[isUserPosLinked] Point of sale [${idPos}] is not linked with user [${idUser}]`)

    return {code: 0, message: 'Point of Sale not linked with user'};
  }
  catch (e) {
    logger.error(e.message);
    logger.error(e.stack);

    return {code:-1,message:e.message}; // excepción
  }
};

pointOfSaleService.prototype.getPointOfSaleDelegado = async function(token, idPos) {
  const response =  await mssqlDb.launchQuery('transaction',`select up.ID_POS, sup.ID_USER, sup.ID_SUPERVISOR, us.susername, us.enabled, us.ACCOUNT_LOCKED
from USER_POS up
         join SUPERVISOR sup on up.ID_USER = sup.ID_USER
         join users us on us.idUser = up.ID_USER
where up.REMOVED_AT is null
  and sup.REMOVED_AT is null
  and up.id_pos = ${idPos}`);

  toolService.registerAudit({
    user_id: token.idUser,
    eventName: 'get delegado linked to point of sale',
    eventType: 'READ',
    tableName: 'USER_POS',
    rowId: idPos,
    data: token.sub
  });

  return response;
}

pointOfSaleService.prototype.getPointsOfSaleByPromotion = async function(token, idPromotion) {
  const response = await mssqlDb.launchQuery(`select * from PS_DIM_PROMOTION pdp
join PS_DIM_BRAND pdb on pdp.ID_BRAND = pdb.ID_BRAND
         join PS_DIM_POS_PROMOTION pdpp on pdpp.ID_PROMOTION = pdp.ID_PROMOTION
         join PS_DIM_POINT_OF_SALE pos on pos.ID_POS = pdpp.ID_POS
where pdpp.ID_PROMOTION = ${idPromotion}`)

  toolService.registerAudit({
    user_id: token.idUser,
    eventName: 'get point of sale by Promotion',
    eventType: 'READ',
    tableName: 'PS_DIM_POINT_OF_SALE',
    rowId: idPromotion,
    data: token.sub
  });

  return response;
}

pointOfSaleService.prototype.getPointOfSaleByDelegado = async function(token, idDelegado) {
  const response =  await mssqlDb.launchQuery('transaction', `select 
ID_POS, NAME, CIF, EMAIL, IBAN, PHONE, CELL_PHONE, CONTACT_PERSON, PAYMENT_MEAN,
MAILING_NOTIFICATION, MAIN_STREET, MAIN_CITY, MAIN_STATE, MAIN_ZIP_CODE,
SHIPMENT_STREET, SHIPMENT_CITY, SHIPMENT_STATE, SHIPMENT_ZIP_CODE, POS_APP,
CATEGORY, REMOTE_STORE_ID, COUNTRY 
from PS_DIM_POINT_OF_SALE
where ID_POS in (select distinct(id_pos)
                 from USER_POS up
                 where up.id_user = ${idDelegado}
                    or up.ID_USER in (select SUPERVISOR.ID_USER
                                      from SUPERVISOR
                                      where ID_SUPERVISOR = ${idDelegado}))`);

  toolService.registerAudit({
    user_id: token.idUser,
    eventName: 'get points of sale by delegado',
    eventType: 'READ',
    tableName: 'PS_DIM_POINT_OF_SALE',
    rowId: idDelegado,
    data: token.sub
  });

  return response;
}

pointOfSaleService.prototype.updateLinkPointOfSaleToDelegado = async function(token, idDelegado, idPos) {
  const response = await mssqlDb.launchQuery('transaction',`update USER_POS set ID_USER=${idDelegado} where ID_POS = ${idPos};`)

  toolService.registerAudit({
    user_id: token.idUser,
    eventName: 'update link Point of Sale to Delegado',
    eventType: 'UPDATE',
    tableName: 'USER_POS',
    rowId: `(select id from user_pos where id_user = ${idDelegado} and id_pos = ${idPos})`,
    data: `pos ${idPos} with user ${idDelegado}`
  });

  return response;

};

pointOfSaleService.prototype.createLinkPointOfSaleToDelegado = async function(token, idDelegado, idPos) {
  const response = await mssqlDb.launchQuery('transaction',`insert into USER_POS (ID_USER, ID_POS, CREATED_AT, REMOVED_AT) 
values (${idDelegado},${idPos},current_timestamp,null);`)

  toolService.registerAudit({
    user_id: token.idUser,
    eventName: 'create link Point of Sale to Delegado',
    eventType: 'INSERT',
    tableName: 'USER_POS',
    rowId: '(select max(id) from user_pos)',
    data: `pos ${idPos} with user ${idDelegado}`
  });

  return response;
}

pointOfSaleService.prototype.getPromotions = async function(token, idManufacturer, idPos) {
  const response = await mssqlDb.launchQuery('transaction', `select pdp.ID_PROMOTION, pdp.PROMOTION_NAME, pdp.PROMOTION_REFERENCE,pdp.PROMOTION_END_DATE,pdp.PROMOTION_START_DATE, pdp.PROMOTION_POSTMARK_DATE, pdpp.ID_POS 
from PS_DIM_PROMOTION pdp
join PS_DIM_BRAND pdb on pdp.ID_BRAND = pdb.ID_BRAND
         left join PS_DIM_POS_PROMOTION pdpp on pdpp.ID_PROMOTION = pdp.ID_PROMOTION
where pdb.ID_MANUFACTURER = ${idManufacturer}
and (pdpp.ID_POS is null or pdpp.ID_POS = ${idPos})
and pdp.PROMOTION_POSTMARK_DATE > dateadd(DAY, -30, current_timestamp)`);

  toolService.registerAudit({
    user_id: token.idUser,
    eventName: 'get Promotions',
    eventType: 'READ',
    tableName: 'PS_DIM_PROMOTIONS',
    rowId: idPos,
    data: `Manufacturer ${idManufacturer} POS ${idPos}`
  });

  return response;
}

pointOfSaleService.prototype.getPointOfSale = async function(token, idPos) {
  const response =  await mssqlDb.launchQuery('transaction', `select 
ID_POS, NAME, CIF, EMAIL, IBAN, PHONE, CELL_PHONE, CONTACT_PERSON, PAYMENT_MEAN,
MAILING_NOTIFICATION, MAIN_STREET, MAIN_CITY, MAIN_STATE, MAIN_ZIP_CODE,
SHIPMENT_STREET, SHIPMENT_CITY, SHIPMENT_STATE, SHIPMENT_ZIP_CODE, POS_APP,
CATEGORY, REMOTE_STORE_ID, COUNTRY 
from  PS_DIM_POINT_OF_SALE pos where pos.ID_POS = ${idPos}`);

  toolService.registerAudit({
    user_id: token.idUser,
    eventName: 'get point of sale by ID',
    eventType: 'READ',
    tableName: 'PS_DIM_POINT_OF_SALE',
    rowId: idPos,
    data: token.sub
  });

  return response;
};

exports.pointOfSaleService = pointOfSaleService;

exports.create = function() {
  return new pointOfSaleService();
};
