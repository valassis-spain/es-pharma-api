const {Router} = require('express');
const {logger} = require('../config');
const router = Router();
// const mssqlDb = require('../lib/mssqldb').create();

const userService = require('../services/userService').create();

const {verifyToken, issueAccessToken, issueRefreshToken} = require('../lib/jwt');
const {randomUUID} = require("crypto");
const delegadoService = require('../services/delegadoService').create();
const toolService = require('../services/toolService').create();
const mailjetLib = require('../lib/mailjet').create();

const message01 = 'Invalid credentials!';
const message02 = 'Incorrect user or password!';
const message03 = 'User access denied!';

// Raiz
router.post('/', async (req, res) => {
  const bcrypt = require('bcrypt');
  let resStatus = 200;

  const {username, password, origin} = req.body;

  logger.info(`login page {username:${username}}`);

  try {
    if (!username || !password) {
      resStatus = 403;
      logger.debug('No username or password received');

      toolService.registerAudit({
        user_id: 52,
        eventName: 'login failed',
        eventType: 'READ',
        tableName: 'USERS',
        rowId: 0,
        data: 'No username or password received'
      });

      throw new Error(message01 + ' (L1)');
    }

    const mapping = await userService.getUserByUsername(null, username);

    if (mapping.length !== 1) {
      resStatus = 403;
      logger.debug(`User not Found [${mapping.length} of ${username}]`);

      toolService.registerAudit({
        user_id: 52,
        eventName: 'login failed',
        eventType: 'READ',
        tableName: 'USERS',
        rowId: 0,
        data: `User not Found [${mapping.length} of ${username}]`
      });

      throw new Error(message01 + ' (L2)');
    }

    const match = await bcrypt.compare(password, mapping[0].sPassword);

    if (!match) {
      resStatus = 403;
      logger.debug(`Password not match [${username}]`);

      toolService.registerAudit({
        user_id: mapping[0].idUser,
        eventName: 'login failed',
        eventType: 'READ',
        tableName: 'USERS',
        rowId: 0,
        data: `Password not match [${username}]`
      });

      throw new Error(message02 + ' (L3)');
    }

    // verify user details
    if (!mapping[0].enabled || mapping[0].account_Expired || mapping[0].account_Locked || mapping[0].password_Expired) {
      resStatus = 403;
      logger.debug(`disabled user [${username}]`);

      toolService.registerAudit({
        user_id: mapping[0].idUser,
        eventName: 'login failed',
        eventType: 'READ',
        tableName: 'USERS',
        rowId: 0,
        data: `disabled user [${username}]`
      });

      throw new Error(message03 + ' (L4)');
    }

    // test origin
    const isMemberOf = await userService.memberOf({idUser: mapping[0].idUser, sub: username}, origin, username);

    if (origin === process.env.ORIGIN_APP && !(isMemberOf.ROLE_USER || isMemberOf.ROLE_ADMIN)) {
      logger.debug(`User is not Pharma [${username}]`);

      toolService.registerAudit({
        user_id: mapping[0].idUser,
        eventName: 'login failed',
        eventType: 'READ',
        tableName: 'USERS',
        rowId: 0,
        data: `User is not Pharma [${username}]`
      });
    }

    if (origin === process.env.ORIGIN_DELEGADO && !(isMemberOf.ROLE_DELEGADO || isMemberOf.ROLE_SUPERVISOR)) {
      resStatus = 403;
      logger.debug(`User is not Delegado [${username}]`);

      toolService.registerAudit({
        user_id: mapping[0].idUser,
        eventName: 'login failed',
        eventType: 'READ',
        tableName: 'USERS',
        rowId: 0,
        data: `User is not Delegado [${username}]`
      });

      throw new Error(message03 + ' (L6)');
    }

    const accessClaim = {
      idPos: mapping[0].id_pos,
      idUser: mapping[0].idUser,
      country: 'es'
    };

    const refreshClaim = {
      idPos: mapping[0].id_pos,
      idUser: mapping[0].idUser,
      country: 'es'
    };

    accessClaim[process.env.ACCESS_CLAIM] = true;
    accessClaim['sub'] = username;
    refreshClaim[process.env.REFRESH_CLAIM] = true;
    refreshClaim['sub'] = username;

    const access_token = issueAccessToken(accessClaim);
    const refresh_token = issueRefreshToken(refreshClaim);

    const mappingManufacturers = await delegadoService.getMyManufacturers(accessClaim, mapping[0].idUser);

    const verified = verifyToken(access_token);
    logger.debug(`JWT verification: ${JSON.stringify(verified)}`);

    toolService.registerAudit({
      user_id: mapping[0].idUser,
      eventName: 'login success',
      eventType: 'READ',
      tableName: 'USERS',
      rowId: mapping[0].idUser,
      data: username
    });

    toolService.registerActivity({
      user_id: mapping[0].idUser,
      idPos: mapping[0].id_pos,
      action: 'Login',
      origin: origin
    });

    logger.info(`Access granted to ${username}`);

    res.json(
      {
        id_pos: mapping[0].id_pos,
        id_user: mapping[0].idUser,
        status: mapping[0].category,
        roles: isMemberOf.roles,
        manufacturers: mappingManufacturers,
        access_token: access_token,
        refresh_token: refresh_token,
        country: ''
      }
    );
  }
  catch (e) {
    logger.error(e.stack);
    res.status(resStatus === 200 ? 500 : resStatus).json({message: e.message + ' (LE)'});
  }
});

async function sendEmailCode(mappingUser, email, res, origin) {
  // generate unique code
  const { randomUUID } = require('crypto'); // Added in: node v14.17.0
  let uuid = randomUUID();
  const host = process.env.HOST;

  const body = '' +
    '<!-- CSS only -->\n' +
    '<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.1/dist/css/bootstrap.min.css" rel="stylesheet" crossorigin="anonymous">' +
    '<div>' +
    'Hola,<br/>' +
    '<br/>' +
    '    Gracias por acceder a la APP para Delegados de *****.<br/>' +
    '<br/>' +
    '    Para completar el registro necesitamos la confirmación de tu dirección de correo electrónico.<br/>' +
    '<br/>' +
    '    Por favor, haz click en el botón para confirmar tu dirección:<br/>' +
    '<br/>' +
    '    <a class="btn btn-primary text-center" href="'+host+'/api/deleg/authenticate/verifyCode?uuid='+uuid+'&email='+email+'">Verificar mi dirección</a> <br/>' +
    '<br/>' +
    '    Si tienes algún problema tienes nuestros datos de contacto en el pie de este correo.<br/>' +
    '<br/>' +
    '    Muchas gracias.<br/>' +
    '<br/>' +
    '</div>';

  // send email with unique code
  const mjResponse = await mailjetLib.sendEmail('fjperez@savispain.es', body);

  if ( mjResponse && mjResponse.response.status === 200  ) {
    // email sended successfully
    // update user with unique code sended
    const updateResp = await userService.updateUserWithCode(null, mappingUser[0].idUser, uuid);

    logger.debug(`Mailjet Response: ${JSON.stringify(mjResponse.response.data.Messages,null,2)}`);

    toolService.registerActivity({
      user_id: mappingUser[0].idUser,
      idPos: mappingUser[0].id_pos,
      action: 'Register mail',
      origin: origin
    });

    return true;
  }
  else {
    logger.error(`Error sended register email`);

    toolService.registerAudit({
      user_id: mappingUser[0].idUser,
      eventName: 'error sending email code ',
      eventType: 'READ',
      tableName: 'USERS_GROUPS',
      rowId: mappingUser[0].idUser,
      data: email
    });

    return false;
  }
}

async function checkUserByEmail(email, res, origin) {
  let mappingUser, mappingRoles, errors;
  if (!email) {
    res.status(400).json({message: 'missing required field email'});
    errors = true;
  }

  if (!errors) {
    mappingUser = await userService.getUserByUsername(null, email);
    if (!mappingUser || mappingUser.length !== 1) {
      logger.error(`Found ${mappingUser.length} of ${email}`);

      toolService.registerAudit({
        user_id: 52,
        eventName: 'User by email error',
        eventType: 'READ',
        tableName: 'USERS',
        rowId: 0,
        data: email
      });

      res.status(403).json({message: 'username not found'});
      errors = true;
    }
  }

  if (!errors) {
    mappingRoles = await userService.memberOf(null, origin, email);
    if (!mappingRoles || mappingRoles.length === 0) {
      logger.error(`Found ${mappingRoles.length} of ${email}`);

      toolService.registerAudit({
        user_id: mappingUser[0].idUser,
        eventName: 'email receives hasn\'t roles',
        eventType: 'READ',
        tableName: 'USERS_GROUPS',
        rowId: mappingUser[0].idUser,
        data: email
      });

      res.status(403).json({message: 'username has incorrect role'});
      errors = true;
    }
    else if (!mappingRoles.ROLE_DELEGADO && !mappingRoles.ROLE_SUPERVISOR) {
      logger.error(`Role not allowed ${email}`);

      toolService.registerAudit({
        user_id: mappingUser[0].idUser,
        eventName: 'email receives hasn\'t correct role',
        eventType: 'READ',
        tableName: 'USERS_GROUPS',
        rowId: mappingUser[0].idUser,
        data: email
      });

      res.status(403).json({message: 'username has incorrect role'});
      errors = true;
    }
  }
  return {errors, mappingUser};
}

router.post('/resendCode', async function(req, res, next) {
  logger.info('Reenvio código verificación de delegado');
  const {origin, email} = req.body;
  let errors = false;
  let mappingUser, mappingRoles

  try {
    const __ret = await checkUserByEmail(email, res, origin);
    errors = __ret.errors;
    mappingUser = __ret.mappingUser;

    if ( !errors ) {
      // if user don't still verified email account
      if ( !mappingUser[0].enabled && mappingUser[0].account_Locked) {
        let sendEmailResponse = await sendEmailCode(mappingUser, email, res, origin);

        if ( sendEmailResponse ) {
          toolService.registerActivity({
            user_id: mappingUser[0].idUser,
            idPos: mappingUser[0].id_pos,
            action: 'Resend 0',
            origin: origin
          });
          res.status(200).json({message: 'User accepted', code: 0})
        }
        else {
          res.status(500).json({message:'Error sending email'});
        }
      }
      else if ( mappingUser[0].enabled && mappingUser[0].account_Locked) {
        // email code has been sended but not verified, resend email
        let sendEmailResponse = await sendEmailCode(mappingUser, email, res, origin);

        if ( sendEmailResponse ) {
          toolService.registerActivity({
            user_id: mappingUser[0].idUser,
            idPos: mappingUser[0].id_pos,
            action: 'Resend 1',
            origin: origin
          });
          res.status(200).json({message: 'User accepted', code: 1})
        }
        else {
          res.status(500).json({message:'Error sending email'});
        }
      }
      else if ( mappingUser[0].enabled && !mappingUser[0].account_Locked) {
        // access granted
        toolService.registerActivity({
          user_id: mappingUser[0].idUser,
          idPos: mappingUser[0].id_pos,
          action: 'Resend 2',
          origin: origin
        });
        res.status(200).json({message:'User accepted',code:2})
      }
    }
  }
  catch (e) {
    logger.error(`Error en el registro del delegado [${email}]`);
    logger.error(e.stack);
    res.status(500);
  }
});

router.post('/register', async function(req, res, next) {
  logger.info('Registro delegado');

  const {origin, email} = req.body;
  let errors = false;
  let mappingUser, mappingRoles

  try {
    const __ret = await checkUserByEmail(email, res, origin);
    errors = __ret.errors;
    mappingUser = __ret.mappingUser;

    if ( !errors ) {
      // if user don't still verified email account
      if ( !mappingUser[0].enabled && mappingUser[0].account_Locked) {
        await sendEmailCode(mappingUser, email, res, origin);
        toolService.registerActivity({
          user_id: mappingUser[0].idUser,
          idPos: mappingUser[0].id_pos,
          action: 'Register 0',
          origin: origin
        });
        res.status(200).json({message:'User accepted',code:0})
      }
      else if ( mappingUser[0].enabled && mappingUser[0].account_Locked) {
        // email code has been sended but not verified
        toolService.registerActivity({
          user_id: mappingUser[0].idUser,
          idPos: mappingUser[0].id_pos,
          action: 'Register 1',
          origin: origin
        });
        res.status(200).json({message:'User accepted',code:1})
      }
      else if ( mappingUser[0].enabled && !mappingUser[0].account_Locked) {
        // access granted
        toolService.registerActivity({
          user_id: mappingUser[0].idUser,
          idPos: mappingUser[0].id_pos,
          action: 'Register 2',
          origin: origin
        });
        res.status(200).json({message:'User accepted',code:2, idUser: mappingUser[0].idUser})
      }
    }
  }
  catch (e) {
    logger.error(`Error en el registro del delegado [${email}]`);
    logger.error(e.stack);
    res.status(500);
  }
});

router.get('/verifyCode', async function(req, res, next) {
  logger.info('Registro delegado - verificación');

  const {origin} = req.body;
  const {email, uuid} = req.query;
  let errors = false;
  let mappingUser

  try {
    const __ret = await checkUserByEmail(email, res, origin);
    errors = __ret.errors;
    mappingUser = __ret.mappingUser;

    if ( !errors && uuid !== mappingUser[0].sPassword) {
      logger.error(`${email} UUID received and UUID saved are different`);
      res.status(403).json({message: 'Error: code not match'});
      toolService.registerAudit({
        user_id: mappingUser[0].idUser,
        eventName: 'email code received not match',
        eventType: 'READ',
        tableName: 'USERS',
        rowId: mappingUser[0].idUser,
        data: email
      });
      errors = true;
    }

    if ( !errors ) {
      await userService.updateUserCodeVerified(null, mappingUser[0].idUser, uuid);

      logger.info(`User ${email} verified with email code`)
      toolService.registerActivity({
        user_id: mappingUser[0].idUser,
        idPos: mappingUser[0].id_pos,
        action: 'Register V',
        origin: origin
      });

      // todo: make a HTML beauty response
      res.status(200).json({message:'code accepted'})
    }
  }
  catch (e) {
    logger.error(`Error en el registro del delegado [${email}]`);
    logger.error(e.stack);
    res.status(500);
  }
});

router.post('/setpwd', async function(req, res, next) {
  logger.info('delegado - establecer contraseña');

  const {origin, idUser, email, pwd} = req.body;
  let errors = false;
  let mappingUser

  try {
    const __ret = await checkUserByEmail(email, res, origin);
    errors = __ret.errors;
    mappingUser = __ret.mappingUser;

    // if ( !errors && idUser !== mappingUser[0].idUser ) {
    //   logger.error(`${email} ID received and ID saved are different: ${idUser} <> ${mappingUser[0].idUser}`);
    //   res.status(403).json({message: 'Error: id not match'});
    //   toolService.registerAudit({
    //     user_id: mappingUser[0].idUser,
    //     eventName: 'set PWD: ids not match',
    //     eventType: 'READ',
    //     tableName: 'USERS',
    //     rowId: mappingUser[0].idUser,
    //     data: email
    //   });
    //   errors = true;
    // }

    if ( !errors ) {
      const bcrypt = require('bcrypt');
      let newPwd
      await bcrypt.hash(pwd, 10, async function(err, hash) {
        if ( !err ) {
          await userService.updateUserPwd(null, mappingUser[0].idUser, hash);

          logger.info(`User ${email} has new password`)
          toolService.registerActivity({
            user_id: mappingUser[0].idUser,
            idPos: mappingUser[0].id_pos,
            action: 'Set PWD',
            origin: origin
          });

          res.status(200).json({message: 'password updated'})
        }
        else {
          logger.error ( 'Error hashing password' )
          logger.error ( err )
          res.status(500);
        }
      });
    }
  }
  catch (e) {
    logger.error(`Error en el registro del delegado [${email}]`);
    logger.error(e.stack);
    res.status(500);
  }
});

module.exports = router;
