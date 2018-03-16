require('dotenv').config();
require('isomorphic-fetch');
const cheerio = require('cheerio');
const redis = require('redis');
const util = require('util');
const Json2csvParser = require('json2csv').Parser;

const redisOptions = {
  url: process.env.REDIS_URL,
  EX: process.env.REDIS_EXPIRE,
};

const client = redis.createClient(redisOptions);

const asyncGet = util.promisify(client.get).bind(client);
const asyncSet = util.promisify(client.mset).bind(client);
const asyncKeys = util.promisify(client.keys).bind(client);
const asyncDel = util.promisify(client.del).bind(client);

async function get(cacheKey) {
  const cached = await asyncGet(cacheKey);

  if (cached) { return cached; }

  const url = 'http://www.ksi.is/mot/motalisti/urslit-stada/?MotNumer=37403';
  const response = await fetch(url);
  const text = await response.text();

  await asyncSet(cacheKey, text);
  return text;
}

/**
 * Sækir svið eftir `slug`. Fáum gögn annaðhvort beint frá vef eða úr cache.
 *
 * @param {string} slug - Slug fyrir svið sem skal sækja
 * @returns {Promise} Promise sem mun innihalda gögn fyrir svið eða null ef það finnst ekki
 */
async function getTests() {
  const cacheKey = 'pepsiKarla';

  const text = await get(cacheKey);

  const $ = cheerio.load(text);

  const tbody = $('tbody');
  const rows = $(tbody).find('tr');

  const csvData = [];

  $(rows).each((i, el) => {
    const data = $(el).find('td');
    const number = $(data[0]).text();
    const date = $(data[1]).text();
    const time = $(data[2]).text();
    const teams = $(data[3]).text();
    const venue = $(data[4]).text();

    csvData.push({
      number,
      date,
      time,
      teams,
      venue,
    });
  });
  // const fields = ['number', 'date', 'time', 'teams', 'venue'];

  // const Json2csv = new Json2csvParser({ fields });
  // const csv = Json2csv.parse(csvData);

  return csvData;
}

/**
 * Hreinsar cache.
 *
 * @returns {Promise} Promise sem mun innihalda boolean um hvort cache hafi verið hreinsað eða ekki.
 */
async function clearCache() {
  try {
    const pattern = 'pepsiKarla';
    const keys = await asyncKeys(pattern);
    await asyncDel.apply(client, keys);
  } catch (error) {
    console.error(error);
    return false;
  }

  return true;
}

module.exports = {
  getTests,
  clearCache,
};
