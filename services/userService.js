// const {logger} = require('../config');
// const {issueAccessToken} = require('../lib/jwt');
const mssqlDb = require('../lib/mssqldb').create();
const toolService = require('./toolService').create();

const userService = function() {
};

userService.prototype.getUserByUsername = async function(token, username) {
  const response = await mssqlDb.launchQuery('transaction', `select 
us.idUser, us.sUsername, us.sPassword, us.id_pos, us.enabled, us.account_Expired, us.account_Locked, us.password_Expired, pos.category, sup.id_supervisor 
from users us 
left join PS_DIM_POINT_OF_SALE pos on pos.id_pos = us.id_pos 
left join SUPERVISOR sup on sup.id_user = us.idUser
where us.sUsername = '${username}'`);

  if (token) {
    toolService.registerAudit({
      user_id: token.idUser,
      eventName: 'get user by username',
      eventType: 'READ',
      tableName: 'USERS',
      rowId: `(select idUser from users where susername='${username}')`,
      data: token.sub
    });
  }

  return response;
};

userService.prototype.getUserById = async function(token, idUser) {
  const response = await mssqlDb.launchQuery('transaction', `select 
us.idUser, us.sUsername, us.sPassword, us.id_pos, us.enabled, us.account_Expired, us.account_Locked, us.password_Expired, pos.category 
from users us 
left join PS_DIM_POINT_OF_SALE pos on pos.id_pos = us.id_pos 
left join SUPERVISOR sup on sup.id_user = us.idUser
where us.idUser=${idUser}`);

  toolService.registerAudit({
    user_id: token.idUser,
    eventName: 'get user by ID',
    eventType: 'READ',
    tableName: 'USERS',
    rowId: idUser,
    data: token.sub
  });

  return response;
};

userService.prototype.getUserDetailsById = async function(token, idUser) {
  const response = await mssqlDb.launchQuery('transaction', `select 
id, id_user, name,email,phone,address,city,zip_code,state,country,removed_at 
from  USER_DETAIL ud 
where ud.id_user = ${idUser}`);

  toolService.registerAudit({
    user_id: token.idUser,
    eventName: 'get user details by ID',
    eventType: 'READ',
    tableName: 'USER_DETAIL',
    rowId: idUser,
    data: token.sub
  });

  return response;
};

userService.prototype.disableUser = async function(token, idUser) {
  const response = await mssqlDb.launchQuery('transaction', `update USERS set ENABLED=0, ACCOUNT_LOCKED=1 
where idUser=${idUser}`);

  toolService.registerAudit({
    user_id: token.idUser,
    eventName: 'disable user',
    eventType: 'UPDATE',
    tableName: 'USERS',
    rowId: idUser,
    data: token.sub
  });

  return response;
};

userService.prototype.logicalRemove = async function(token, idUser) {
  const response = await mssqlDb.launchQuery('transaction', `update USER_DETAIL set REMOVED_AT=current_timestamp, REMOVED_BY=${token.idUser} 
where ID_USER=${idUser}`);

  toolService.registerAudit({
    user_id: token.idUser,
    eventName: 'logical remove user details',
    eventType: 'UPDATE',
    tableName: 'USER_DETAIL',
    rowId: idUser,
    data: token.sub
  });

  return response;
};

userService.prototype.createUserDetails = async function(token, idDelegado, values = {}) {
  const response = await mssqlDb.launchQuery('transaction', `insert into USER_DETAIL (ID_USER, NAME, EMAIL, PHONE, ADDRESS, CITY, ZIP_CODE, STATE, COUNTRY, CREATED_AT)
values (${idDelegado},
'${values.name}',
'${values.email}',
'${values.phone}',
'${values.address}',
'${values.city}',
${values.zipCode ? values.zipCode : 0},
'${values.state}',
'${values.country ? values.country : 'es'}',
current_timestamp)`);

  toolService.registerAudit({
    user_id: token.idUser,
    eventName: 'add user details',
    eventType: 'INSERT',
    tableName: 'USER_DETAIL',
    rowId: idDelegado,
    data: token.sub
  });

  return response;
};

userService.prototype.updateUserDetails = async function(token, idDelegado, values = {}) {
  const response = await mssqlDb.launchQuery('transaction', `update USER_DETAIL set 
${values.name ? 'NAME=\'' + values.name + '\',' : ''}
${values.phone ? 'PHONE=\'' + values.phone + '\',' : ''}
${values.address ? 'ADDRESS=\'' + values.address + '\',' : ''}
${values.city ? 'CITY=\'' + values.city + '\',' : ''}
${values.zipCode ? 'ZIP_CODE=\'' + values.zipCode + '\',' : ''}
${values.state ? 'STATE=\'' + values.state + '\',' : ''}
${values.country ? 'COUNTRY=\'' + values.country + '\',' : ''}
UPDATED_AT=current_timestamp, UPDATED_BY=${token.idUser} 
where ID_USER=${idDelegado}`);

  toolService.registerAudit({
    user_id: token.idUser,
    eventName: 'update user details',
    eventType: 'UPDATE',
    tableName: 'USER_DETAILS',
    rowId: idDelegado,
    data: token.sub
  });

  return response;
};

userService.prototype.memberOf = async function(token, origin, username) {
  // get user groups
  const mappingGroups = await mssqlDb.launchQuery('transaction', `select g.sGroupCode rol
from users us
    left join USER_GROUPS ug on us.idUser = ug.idUser
    left join GROUPS g on ug.idGroup = g.idGroup
where us.sUsername = '${username}'`);

  if (token) {
    toolService.registerAudit({
      user_id: token.idUser,
      eventName: 'get user groups by username',
      eventType: 'READ',
      tableName: 'SUPERVISOR',
      rowId: `(select idUser from users where susername='${username}')`,
      data: username
    });
  }

  const memberOf = {
    roles: mappingGroups
  };

  for (const rol of mappingGroups)
    memberOf[rol.rol] = true;

  return memberOf;
};

exports.userService = userService;

exports.create = function() {
  return new userService();
};
