// const {logger} = require('../config');
require('dotenv').config();

const Mailjet = require('node-mailjet');

const mailJetLib = function() {
  this._logger = require('../config').logger;
};

mailJetLib.prototype.sendEmail = async function(toEmail, subject, body) {
  let attachments;

  const mailjet = new Mailjet({
    apiKey: process.env.MJ_APIKEY_PUBLIC || 'your-api-key',
    apiSecret: process.env.MJ_APIKEY_PRIVATE || 'your-api-secret'
  });

  const sender = {
    email: process.env.MJ_FROM_EMAIL,
    name: process.env.MJ_FROM_NAME,
    campaign: process.env.MJ_CAMPAIGN_NAME
  };

  const user = {
    email: toEmail,
    templateVariables: {}
  };

  user.templateVariables[process.env.MJ_VBLE2] = body;
  user.templateVariables[process.env.MJ_VBLE1] = 'TEXTO 2';

  const msj = {
    Messages: [
      {
        From: {
          Email: sender.email,
          Name: sender.name
        },
        To: [
          {
            Email: user.email,
            Name: user.full_name ? user.full_name : ''
          }
        ],
        Subject: subject,
        CustomCampaign: sender.campaign,
        TemplateID: Number(process.env.MJ_TEMPLATE_ID),
        TemplateLanguage: true,
        Variables: user.templateVariables,
        Attachments: attachments ? attachments : null
      }
    ]
  };

  const request = mailjet
    .post('send', {version: 'v3.1'})
    .request(msj);

  return request
    .then((result) => {
      return result;
    })
    .catch((err) => {
      console.log(err);

      return false;
    });
};

exports.mailJetLib = mailJetLib;

exports.create = function() {
  return new mailJetLib();
};
