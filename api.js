const express = require('express');

const router = express.Router();

const {
  departments,
  getTests,
  clearCache,
  getStats,
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

/**
 * Higher order fall sem vefur middleware í villumeðhöndlun.
 *
 * @param {function} fn Middleware sem passað skal uppá
 * @returns {function} Middleware með villumeðhöndlun
 */
function catchErrors(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

function indexRoute(req, res) {
  const timer = timerStart();

  const depts = departments.map(dept => ({
    name: dept.name,
    link: `/${dept.slug}`,
  }));

  const elapsed = timerEnd(timer);

  res.json({
    elapsed,
    departments: depts,
    clearCache: '/clearCache',
    stats: '/stats',
  });
}

async function testsRoute(req, res, next) {
  const timer = timerStart();
  const { slug } = req.params;

  let tests;

  try {
    tests = await getTests(slug);
  } catch (error) {
    return next(error);
  }


  if (tests === null) {
    return next();
  }

  const elapsed = timerEnd(timer);

  return res.json({
    elapsed,
    school: tests,
  });
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

async function statsRoute(req, res, next) {
  const timer = timerStart();

  let stats;

  try {
    stats = await getStats();
  } catch (error) {
    return next(error);
  }

  const elapsed = timerEnd(timer);

  return res.json({
    elapsed,
    stats,
  });
}

router.get('/', indexRoute);
router.get('/stats', catchErrors(statsRoute));
router.get('/clearCache', catchErrors(clearCacheRoute));
router.get('/:slug', catchErrors(testsRoute));

module.exports = router;
