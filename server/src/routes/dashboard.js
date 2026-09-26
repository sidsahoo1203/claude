const express = require('express');
const { wrap } = require('../lib/errors');
const { dashboard } = require('../services/dashboard');

const router = express.Router();
router.get('/', wrap(async (req, res) => res.json(await dashboard())));

module.exports = router;
