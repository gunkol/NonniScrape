require('dotenv').config();
require('isomorphic-fetch');
const cheerio = require('cheerio');
const redis = require('redis');
const util = require('util');

const redisOptions = {
  url: process.env.REDIS_URL,
  EX: process.env.REDIS_EXPIRE,
};

const client = redis.createClient(redisOptions);

const asyncGet = util.promisify(client.get).bind(client);
const asyncSet = util.promisify(client.mset).bind(client);
const asyncKeys = util.promisify(client.keys).bind(client);
const asyncDel = util.promisify(client.del).bind(client);


/**
 * Listi af sviðum með „slug“ fyrir vefþjónustu og viðbættum upplýsingum til
 * að geta sótt gögn.
 */
const departments = [
  {
    name: 'Félagsvísindasvið',
    slug: 'felagsvisindasvid',
  },
  {
    name: 'Heilbrigðisvísindasvið',
    slug: 'heilbrigdisvisindasvid',
  },
  {
    name: 'Hugvísindasvið',
    slug: 'hugvisindasvid',
  },
  {
    name: 'Menntavísindasvið',
    slug: 'menntavisindasvid',
  },
  {
    name: 'Verkfræði- og náttúruvísindasvið',
    slug: 'verkfraedi-og-natturuvisindasvid',
  },
];

function getId(slug) {
  switch (slug) {
    case 'felagsvisindasvid': return 1;
    case 'heilbrigdisvisindasvid': return 2;
    case 'hugvisindasvid': return 3;
    case 'menntavisindasvid': return 4;
    case 'verkfraedi-og-natturuvisindasvid': return 5;
    default: return null;
  }
}

async function get(id, cacheKey) {
  const cached = await asyncGet(cacheKey);

  if (cached) { return JSON.parse(cached); }

  const url = `https://ugla.hi.is/Proftafla/View/ajax.php?sid=2027&a=getProfSvids&proftaflaID=37&svidID=${id}&notaVinnuToflu=0`;
  const response = await fetch(url);
  const text = await response.json();

  await asyncSet(cacheKey, JSON.stringify(text));
  return text;
}

/**
 * Sækir svið eftir `slug`. Fáum gögn annaðhvort beint frá vef eða úr cache.
 *
 * @param {string} slug - Slug fyrir svið sem skal sækja
 * @returns {Promise} Promise sem mun innihalda gögn fyrir svið eða null ef það finnst ekki
 */
async function getTests(slug) {
  const id = getId(slug);
  const cacheKey = `svid:${id}`;

  const text = await get(id, cacheKey);

  const $ = cheerio.load(text.html);

  const deptHeading = departments[id - 1].name;

  const deptArray = [];

  const tableHeadings = $('h3');

  tableHeadings.each((i, el) => {
    const heading = $(el).text().trim();
    const tests = [];
    const table = $(el).next('table');
    const rows = $(table).find('tbody tr');

    rows.each((j, element) => {
      const data = $(element).find('td');
      const course = $(data[0]).text();
      const name = $(data[1]).text();
      const type = $(data[2]).text();
      const students = Number($(data[3]).text());
      const date = $(data[4]).text();

      tests.push({
        course,
        name,
        type,
        students,
        date,
      });
    });

    deptArray.push({
      heading,
      tests,
    });
  });

  const school = {
    heading: deptHeading,
    departments: deptArray,
  };

  return school;
}

/**
 * Hreinsar cache.
 *
 * @returns {Promise} Promise sem mun innihalda boolean um hvort cache hafi verið hreinsað eða ekki.
 */
async function clearCache() {
  try {
    const pattern = 'svid*';
    const keys = await asyncKeys(pattern);
    await asyncDel.apply(client, keys);
  } catch (error) {
    console.error(error);
    return false;
  }

  return true;
}

/**
 * Sækir tölfræði um fjölda nemenda í prófum, fyrir svið eftir slug
 *
 * @param {string} slug - Slug fyrir svið sem skal sækja
 * @returns {Promise} Promise sem mun innihalda gögn fyrir svið eða null ef það finnst ekki
 */
async function getStudents(slug) {
  const id = getId(slug);
  const cacheKey = `svid:${id}`;

  const text = await get(id, cacheKey);

  const $ = cheerio.load(text.html);

  const noStudents = [];

  const tableHeadings = $('h3');

  tableHeadings.each((i, el) => {
    const table = $(el).next('table');
    const rows = $(table).find('tbody tr');

    rows.each((j, element) => {
      const data = $(element).find('td');
      const students = Number($(data[3]).text());

      noStudents.push(students);
    });
  });

  return noStudents;
}

/**
 * Sækir tölfræði fyrir öll próf allra deilda allra sviða.
 *
 * @returns {Promise} Promise sem mun innihalda object með tölfræði um próf
 */
async function getStats() {
  const cached = await asyncGet('svid:stats');
  if (cached) { return JSON.parse(cached); }

  const slugs = [];

  departments.forEach((el) => {
    slugs.push(el.slug);
  });

  const promises = slugs.map(async slug => getStudents(slug));
  const mapped = await Promise.all(promises);

  const studentsInTest = [];
  let totalTestStudents = 0;
  mapped.forEach((el) => {
    el.forEach((number) => {
      studentsInTest.push(number);
      totalTestStudents += number;
    });
  });

  const min = Math.min(...studentsInTest);
  const max = Math.max(...studentsInTest);
  const numTests = studentsInTest.length;
  const numStudents = totalTestStudents;
  const avg = numStudents / numTests;
  const averageStudents = avg.toFixed(2);

  const stats = {
    min,
    max,
    numTests,
    numStudents,
    averageStudents,
  };

  await asyncSet('svid:stats', JSON.stringify(stats));

  return stats;
}

module.exports = {
  departments,
  getTests,
  clearCache,
  getStats,
};
