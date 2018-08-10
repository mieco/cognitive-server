var express = require('express');
var router = express.Router();

var multer = require('multer')
var upload = multer({
  dest: 'uploads/'
})

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', {
    title: 'Express'
  });
});

router.post('/api/test', upload.single('avatar'), function (req, res, next) {
  console.log(req.file);
  console.log(req.body);
  res.end('success')
});



module.exports = router;