const express = require('express');
const Json2csvParser = require('json2csv').Parser;

const router = express.Router();

const {
  getTests,
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

async function testsRoute(req, res, next) {
  const timer = timerStart();

  let tests;

  try {
    tests = await getTests();
  } catch (error) {
    return next(error);
  }


  if (tests === null) {
    return next();
  }

  const elapsed = timerEnd(timer);

  return res.json({
    elapsed,
  });
}

async function download(req, res, next) {
  let tests;

  try {
    tests = await getTests();
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

  res.setHeader('Content-disposition', 'attachment; filename=pepsiKK.csv');
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

router.get('/', testsRoute);
router.get('/frontpage', (req, res) => {
  res.render('frontpage');
});
router.get('/download', download);
router.get('/clear', clearCacheRoute);

module.exports = router;
