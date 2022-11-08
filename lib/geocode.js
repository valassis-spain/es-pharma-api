const axios = require('axios');
const {logger} = require('../config');

exports.FindByKeyWord = async function(address) {

  const API_KEY = process.env.G_API_KEY;
  const BASE_URL = process.env.GEOCODE_API_URL;

  // const address = "5 gonzalo chacón, 28300, aranjuez, madrid, españa";

  const url = BASE_URL + address + "&key=" + API_KEY;

  let myResponse = {};

  await axios.get(url)
    .then(function(response) {
      // handle success
      // console.log(response);
      // console.log(JSON.stringify(response.data,null,2));
      // console.log(JSON.stringify(response.data.results[0].geometry,null,2));
      console.log(JSON.stringify(response.data.results[0].geometry.location,null,2));
      myResponse = response.data.results[0].geometry.location;

    })
    .catch(function(error) {
      // handle error
      logger.error(`ERROR calling to bridge ${error}`);
      myResponse = {error:"ERROR calling GEOCODE"};
    });

  return myResponse;
};
