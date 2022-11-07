// const {logger} = require('../config');
// const {issueAccessToken} = require('../lib/jwt');
const mssqlDb = require('../lib/mssqldb').create();
const toolService = require('./toolService').create();

const userService = function() {
};

userService.prototype.updateUserWithCode = async function(token, idUser, uuid) {
  const query = `update USERS set ENABLED=1, spassword=@uuid 
where idUser=@idUser`;

  const queryParams = {};
  queryParams.idUser = idUser;
  queryParams.uuid = uuid;

  const response = await mssqlDb.launchPreparedQuery('transaction', query, queryParams);

  if (token) {
    await toolService.registerAudit({
      user_id: token.idUser,
      eventName: 'mark representative user with unique code',
      eventType: 'UPDATE',
      tableName: 'USERS',
      rowId: idUser,
      data: uuid
    });
  }
  else {
    await toolService.registerAudit({
      user_id: idUser,
      eventName: 'mark representative user with unique code',
      eventType: 'UPDATE',
      tableName: 'USERS',
      rowId: idUser,
      data: uuid
    });
  }

  return response;
};

userService.prototype.updateUserCodeVerified = async function(token, idUser, uuid) {
  const query = `update USERS set account_Locked=0 
where idUser=@idUser`;

  const queryParams = {};
  queryParams.idUser = idUser;

  const response = await mssqlDb.launchPreparedQuery('transaction', query, queryParams);

  if (token) {
    await toolService.registerAudit({
      user_id: token.idUser,
      eventName: 'representative email verified',
      eventType: 'UPDATE',
      tableName: 'USERS',
      rowId: idUser,
      data: uuid
    });
  }
  else {
    await toolService.registerAudit({
      user_id: idUser,
      eventName: 'representative email verified',
      eventType: 'UPDATE',
      tableName: 'USERS',
      rowId: idUser,
      data: uuid
    });
  }

  return response;
};

userService.prototype.updateUserPwd = async function(token, idUser, pwd) {
  const query = `update USERS set sPassword=@pwd 
where idUser=@idUser`;

  const queryParams = {};
  queryParams.idUser = idUser;
  queryParams.pwd = pwd;

  const response = await mssqlDb.launchPreparedQuery('transaction', query, queryParams);

  if (token) {
    await toolService.registerAudit({
      user_id: token.idUser,
      eventName: 'representative set password',
      eventType: 'UPDATE',
      tableName: 'USERS',
      rowId: idUser,
      data: ''
    });
  }
  else {
    await toolService.registerAudit({
      user_id: idUser,
      eventName: 'representative set password',
      eventType: 'UPDATE',
      tableName: 'USERS',
      rowId: idUser,
      data: ''
    });
  }

  return response;
};

userService.prototype.getUserByUsername = async function(token, username, idPos) {
  const query =  `select 
us.idUser, us.sUsername, us.sPassword, ${idPos ? `${idPos}  id_pos` : 'us.id_pos' }, us.enabled, us.account_Expired, us.account_Locked, us.password_Expired, pos.category, sup.id_supervisor,
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
ud.NAME, ud.EMAIL, ud.PHONE                                 
from users us 
left join PS_DIM_POINT_OF_SALE pos on pos.id_pos = ${idPos ? '@idPos' : 'us.id_pos' } 
left join USER_DETAIL ud on us.idUser = ud.ID_USER
left join SUPERVISOR sup on sup.id_user = us.idUser
where us.sUsername = '${username}'`;

  const queryParams = {};
  queryParams.username = username;
  queryParams.idPos = idPos;

  const response = await mssqlDb.launchPreparedQuery('transaction', query, queryParams);

  if (token) {
    await toolService.registerAudit({
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
  const query = `select 
us.idUser, us.sUsername, us.id_pos, pos.category,
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
ud.name, ud.email, ud.phone, ud.removed_at 
from users us 
left join PS_DIM_POINT_OF_SALE pos on pos.id_pos = us.id_pos 
left join SUPERVISOR sup on sup.id_user = us.idUser
left join user_detail ud on ud.id_user = us.idUser 
where us.idUser=@idUser`;

  const queryParams = {};
  queryParams.idUser = idUser;

  const response = await mssqlDb.launchPreparedQuery('transaction', query, queryParams);

  await toolService.registerAudit({
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
  const query = `select 
id, id_user, name,email,phone,address,city,zip_code,state,country,removed_at 
from  USER_DETAIL ud 
where ud.id_user = @idUser`;

  const queryParams = {};
  queryParams.idUser = idUser;

  const response = await mssqlDb.launchPreparedQuery('transaction', query, queryParams);

  await toolService.registerAudit({
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
  const query = `update USERS set ENABLED=0, ACCOUNT_LOCKED=1 
where idUser=@idUser`;

  const queryParams = {};
  queryParams.idUser = idUser;

  const response = await mssqlDb.launchPreparedQuery('transaction', query, queryParams);

  await toolService.registerAudit({
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
  const query = `update USER_DETAIL set REMOVED_AT=current_timestamp, REMOVED_BY=@tokenUser 
where ID_USER=@idUser`;

  const queryParams = {};
  queryParams.idUser = idUser;
  queryParams.tokenUser = token.idUser;

  const response = await mssqlDb.launchPreparedQuery('transaction', query, queryParams);

  await toolService.registerAudit({
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
  const query = `insert into USER_DETAIL (ID_USER, NAME, EMAIL, PHONE, ADDRESS, CITY, ZIP_CODE, STATE, COUNTRY, CREATED_AT)
values (@idDelegado,
@name,
@email,
@phone,
@address,
@city,
@zipCode,
@state,
@country,
current_timestamp)`;

  const queryParams = {};
  queryParams.idDelegado = idDelegado;
  queryParams.name = values.name;
  queryParams.email = values.email;
  queryParams.phone = values.phone;
  queryParams.address = values.address;
  queryParams.city = values.city;
  queryParams.zipCode = ( values.zipCode ? values.zipCode : 0 );
  queryParams.state = values.state;
  queryParams.country = ( values.country ? values.country : 'es');

  const response = await mssqlDb.launchPreparedQuery('transaction', query, queryParams);

  await toolService.registerAudit({
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
  const query = `update USER_DETAIL set 
${values.name ? 'NAME=@name,' : ''}
${values.phone ? 'PHONE=@phone,' : ''}
${values.address ? 'ADDRESS=@address,' : ''}
${values.city ? 'CITY=@city,' : ''}
${values.zipCode ? 'ZIP_CODE=@zipCode,' : ''}
${values.state ? 'STATE=@state,' : ''}
${values.country ? 'COUNTRY=@country,' : ''}
UPDATED_AT=current_timestamp, UPDATED_BY=@tokenUser 
where ID_USER=@idDelegado`;

  const queryParams = {};
  queryParams.idDelegado = idDelegado;
  queryParams.tokenUser = token.idUser;
  queryParams.name = values.name;
  queryParams.email = values.email;
  queryParams.phone = values.phone;
  queryParams.address = values.address;
  queryParams.city = values.city;
  queryParams.zipCode = ( values.zipCode ? values.zipCode : 0 );
  queryParams.state = values.state;
  queryParams.country = ( values.country ? values.country : 'es');

  const response = await mssqlDb.launchPreparedQuery('transaction', query, queryParams);

  await toolService.registerAudit({
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
  const query = `select g.sGroupCode rol
from users us
    left join USER_GROUPS ug on us.idUser = ug.idUser
    left join GROUPS g on ug.idGroup = g.idGroup
where us.sUsername = @username`;

  const queryParams = {};
  queryParams.username = username;

  const mappingGroups = await mssqlDb.launchPreparedQuery('transaction', query, queryParams);

  if (token) {
    await toolService.registerAudit({
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
