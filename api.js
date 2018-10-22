const express = require('express');
const Json2csvParser = require('json2csv').Parser;

const router = express.Router();

const {
  getGames,
  clearCache,
} = require('./scraper');

/**
 * Skilar háskerpu tímasetningu
 *
 * @returns {array} Fylki með tímasetningum
 */
function timerStart() {
  return process.hrtime();
}

/**
 * Skilar fjölda millisekúnda síðan `time`.
 *
 * @param {array} time Háskerpu tímasetning
 * @returns {number} Tími síðan `time` í millisekúndum
 */
function timerEnd(time) {
  const diff = process.hrtime(time);

  const ms = ((diff[0] * 1e9) + diff[1]) / 1e6;

  return ms;
}

async function download(req, res, next) {
  let tests;

  try {
    tests = await getGames();
  } catch (error) {
    return next(error);
  }

  if (tests === null) {
    return next();
  }

  const fields = ['number', 'date', 'time', 'teams', 'venue'];
  const quote = '';
  const delimiter = ';';

  const Json2csv = new Json2csvParser({ fields, quote, delimiter });
  const csv = Json2csv.parse(tests);

  res.setHeader('Content-disposition', 'attachment; filename=bikarKK.csv');
  res.charset = 'utf-8';
  res.set('Content-Type', 'text/csv');
  res.status(200).send(csv);

  return true;
}

async function clearCacheRoute(req, res, next) {
  const timer = timerStart();

  let cleared;

  try {
    cleared = await clearCache();
  } catch (error) {
    return next(error);
  }

  const elapsed = timerEnd(timer);

  return res.json({
    elapsed,
    cleared,
  });
}

// router.get('/', testsRoute);
router.get('/', async (req, res) => {
  const games = await getGames();
  res.render('frontpage', { games });
});
router.get('/download', download);
router.get('/clear', clearCacheRoute);

module.exports = router;
