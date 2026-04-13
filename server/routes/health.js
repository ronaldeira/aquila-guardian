var express = require('express');
var router = express.Router();

router.get('/health', function(req, res) {
  res.json({
    status: 'ok',
    service: 'aquila-guardian',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
