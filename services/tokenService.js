// const {logger} = require('../config');
// const {issueAccessToken} = require('../lib/jwt');
// const mssqlDb = require('../lib/mssqldb').create();

const tokenService = function() {
};

tokenService.prototype.isUserPosLinked = async function(idUser, idPos) {
};

exports.tokenService = tokenService;

exports.create = function() {
  return new tokenService();
};
