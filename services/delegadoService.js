// const {logger} = require('../config');
// const {issueAccessToken} = require('../lib/jwt');
const mssqlDb = require('../lib/mssqldb').create();
const toolService = require('./toolService').create();

const delegadoService = function() {
};

delegadoService.prototype.getMySupervisor = async function(token, idDelegado) {
  const query = `select ud.id_user,ud.name,ud.email,ud.phone,ud.removed_at from SUPERVISOR sup
left join user_detail ud on ud.id_user = sup.id_supervisor 
where sup.id_user = @idDelegado`;

  const queryParams = {};
  queryParams.idDelegado = idDelegado;

  const response = await mssqlDb.launchPreparedQuery('transaction', query, queryParams);

  await toolService.registerAudit({
    user_id: token.idUser,
    eventName: 'get supervisor by delegado',
    eventType: 'READ',
    tableName: 'SUPERVISOR',
    rowId: idDelegado,
    data: token.sub
  });

  return response;
};

/*
state = 1 --> user without activity
state = 2 --> user with email
state = 3 --> user did email verification
state = 4 --> user set his own password
 */
delegadoService.prototype.getMyDelegs = async function(token, idManufacturer, idSupervisor) {
  const query = `select us.idUser,
       us.sUsername,
       us.enabled,
       us.ACCOUNT_LOCKED,
       ud.id_user,
       ud.name,
       ud.email,
       ud.phone,
       ud.removed_at,
       case
           when us.ENABLED = 0 and us.ACCOUNT_LOCKED = 1 and len(us.sPassword) > 36 then 1
           else case
                    when us.ENABLED = 1 and us.ACCOUNT_LOCKED = 1 and len(us.sPassword) <= 36 then 2
                    else case
                             when us.ENABLED = 1 and us.ACCOUNT_LOCKED = 0 and len(us.sPassword) <= 36 then 3
                             else 4
                        end
               end
           end
                                        state,
       (select count(distinct up.id_pos)
        from user_pos up
                 join PS_DIM_MANUFACTURER_POS pdm on pdm.ID_MANUFACTURER = @idManufacturer
                 join PS_DIM_BRAND pdb on pdb.ID_MANUFACTURER = pdm.ID_MANUFACTURER
                 join PS_DIM_PROMOTION pdp on pdb.ID_BRAND = pdp.ID_BRAND
                 join PS_DIM_POS_PROMOTION pdpp on pdpp.ID_PROMOTION = pdp.ID_PROMOTION and pdpp.ID_POS = up.ID_POS
        where up.ID_USER = sup.ID_USER) pos_linked_with_promo,
       (select count(distinct up.id_pos)
        from user_pos up
                 join PS_DIM_MANUFACTURER_POS pdb on pdb.ID_MANUFACTURER = @idManufacturer
        where up.ID_USER = sup.ID_USER) pos_linked
from SUPERVISOR sup
         left join users us on sup.ID_USER = us.idUser
         left join user_detail ud on ud.id_user = us.idUser
where sup.id_supervisor = @idSupervisor`;

  const queryParams = {};
  queryParams.idSupervisor = idSupervisor;
  queryParams.idManufacturer = idManufacturer;

  const response = await mssqlDb.launchPreparedQuery('transaction', query, queryParams);

  await toolService.registerAudit({
    user_id: token.idUser,
    eventName: 'get Delegados by Supervisor',
    eventType: 'READ',
    tableName: 'SUPERVISOR',
    rowId: idSupervisor,
    data: token.sub
  });

  return response;
};

delegadoService.prototype.getDelegadoByPos = async function(token, idManufacturer, idPos) {
  const query =`select us.idUser,
       us.sUsername,
       us.enabled,
       us.ACCOUNT_LOCKED,
       ud.id_user,
       ud.name,
       ud.email,
       ud.phone,
       ud.removed_at,
       case
           when us.ENABLED = 0 and us.ACCOUNT_LOCKED = 1 and len(us.sPassword) > 36 then 1
           else case
                    when us.ENABLED = 1 and us.ACCOUNT_LOCKED = 1 and len(us.sPassword) <= 36 then 2
                    else case
                             when us.ENABLED = 1 and us.ACCOUNT_LOCKED = 0 and len(us.sPassword) <= 36 then 3
                             else 4
                        end
               end
           end
                                        state
from USER_POS up
join users us on up.ID_USER = us.idUser
join USER_GROUPS ug on us.idUser = ug.idUser
join USER_DETAIL ud on us.idUser = ud.ID_USER
join SUPERVISOR sup on us.idUser = sup.ID_USER
where up.ID_POS = @idPos
  and sup.id_manufacturer = @idManufacturer
and ug.idGroup in (4,5)`;

  const queryParams = {};
  queryParams.idManufacturer = idManufacturer;
  queryParams.idPos = idPos;

  const response = await mssqlDb.launchPreparedQuery('transaction', query, queryParams);

  await toolService.registerAudit({
    user_id: token.idUser,
    eventName: 'get Delegados by Supervisor',
    eventType: 'READ',
    tableName: 'SUPERVISOR',
    rowId: idPos,
    data: token.sub
  });

  return response;
};

delegadoService.prototype.getMyManufacturers = async function(token, idDelegado) {
  const query = `select pdm.ID_MANUFACTURER, pdm.MANUFACTURER_NAME 
from SUPERVISOR sup
join PS_DIM_MANUFACTURER pdm on sup.ID_MANUFACTURER = pdm.ID_MANUFACTURER 
where sup.id_supervisor = @idDelegado
group by pdm.ID_MANUFACTURER, pdm.MANUFACTURER_NAME`;

  const queryParams = {};
  queryParams.idDelegado = idDelegado;

  const response = await mssqlDb.launchPreparedQuery('transaction', query, queryParams);

  await toolService.registerAudit({
    user_id: token.idUser,
    eventName: 'get Manufacturers by Delegado',
    eventType: 'READ',
    tableName: 'SUPERVISOR',
    rowId: idDelegado,
    data: token.sub
  });

  return response;
};

delegadoService.prototype.getMyPromotions = async function(token, idManufacturer) {
  const query = `select 
    pdp.ID_PROMOTION, 
    pdp.PROMOTION_NAME, 
    pdp.PROMOTION_REFERENCE, 
    replace(convert(varchar(10),pdp.PROMOTION_START_DATE,111),'/','-') PROMOTION_START_DATE, 
    replace(convert(varchar(10),pdp.PROMOTION_END_DATE,111),'/','-') PROMOTION_END_DATE, 
    replace(convert(varchar(10),pdp.PROMOTION_POSTMARK_DATE,111),'/','-') PROMOTION_POSTMARK_DATE, 
    pdp.promotion_app 
from PS_DIM_PROMOTION pdp
join PS_DIM_BRAND pdb on pdp.ID_BRAND = pdb.ID_BRAND
         join PS_DIM_MANUFACTURER pdm on pdb.ID_MANUFACTURER = pdm.ID_MANUFACTURER
where pdb.ID_MANUFACTURER = @idManufacturer
and pdp.PROMOTION_POSTMARK_DATE > dateadd(DAY, -30, current_timestamp)`;

  const queryParams = {};
  queryParams.idManufacturer = idManufacturer;

  const response = await mssqlDb.launchPreparedQuery('transaction', query, queryParams);

  await toolService.registerAudit({
    user_id: token.idUser,
    eventName: 'get Promotions by Manufacturer',
    eventType: 'READ',
    tableName: 'PS_DIM_PROMOTION',
    rowId: idManufacturer,
    data: token.sub
  });

  return response;
};

exports.delegadoService = delegadoService;

exports.create = function() {
  return new delegadoService();
};
