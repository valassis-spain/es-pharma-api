//* jwt.js
const fs = require('fs')
const path = require('path')
const jwt = require('jsonwebtoken')

const privateKey = fs.readFileSync(path.join(__dirname, '../keys', 'pharma_id_rsa'), 'utf8')
const publicKey = fs.readFileSync(path.join(__dirname, '../keys', 'pharma_id_rsa.pub'), 'utf8')


module.exports = {

  issueAccessToken: (payload) => {
    try {
      return jwt.sign(payload, privateKey, { algorithm: 'RS256', expiresIn:process.env.ACCESS_EXPIRED_IN,issuer:process.env.TOKEN_ISSUER});
    } catch (err) {
      /*
          TODO throw http 500 here
          ! Dont send JWT error messages to the client
          ! Let exception handler handles this error
      */
      throw err
    }
  },

  issueRefreshToken: (payload) => {
    try {
      return jwt.sign(payload, privateKey, { algorithm: 'RS256', expiresIn:process.env.REFRESH_EXPIRED_IN,issuer:process.env.TOKEN_ISSUER});
    } catch (err) {
      /*
          TODO throw http 500 here
          ! Dont send JWT error messages to the client
          ! Let exception handler handles this error
      */
      throw err
    }
  },

  verifyToken: (token) => {
    try {
      return jwt.verify(token, publicKey, { algorithm: 'RS256'});
    } catch (err) {
      /*
          TODO throw http 500 here
          ! Dont send JWT error messages to the client
          ! Let exception handler handles this error
      */
      throw err
    }
  }

}
