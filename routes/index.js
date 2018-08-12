var express = require('express');
var router = express.Router();
const fs = require('fs');
var multer = require('multer')
var upload = multer({
  dest: 'uploads/'
})

const cheerio = require('cheerio');

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

router.post('/api/transfer', upload.single('datafile'), function (req, res, next) {
  // req.file is the `avatar` file
  // req.body will hold the text fields, if there were any

  if (!req.file) return res.send('Please upload a file');
  let file = req.file;
  let filePath = file.path;

  let allRelationTypes = [];
  let allModelTypes = [];
  let result = {
    schema: {
      nodes: [],
      edges: []
    },
    kg: {
      nodes: [],
      edges: []
    }
  };
  fs.readFile(filePath, (err, data) => {
    let $ = cheerio.load(data.toString());

    // get all kinds of models
    $(`owl\\:Class`).each((index, ele) => {
      let about = $(ele).attr('rdf:about');
      let node = {
        id: about,
        label: parseUrl(about)[1],
        type: 'owl:Class'
      }
      result.schema.nodes.push(node);
      allModelTypes.push(parseUrl(about)[1].toLowerCase());
    })

    // get all kinds of relations
    $(`owl\\:ObjectProperty`).each((index, ele) => {
      let about = $(ele).attr('rdf:about');
      let splitAbout = parseUrl(about);
      let sourceDomain = $(ele).find('rdfs\\:domain');
      let targetRange = $(ele).find('rdfs\\:range');
      let domainSplit = parseUrl($(sourceDomain).attr('rdf:resource'));
      let rangeSplit = parseUrl($(targetRange).attr('rdf:resource'));
      let relation = {
        id: about,
        label: splitAbout[1],
        type: 'owl:ObjectProperty',
        source: $(sourceDomain).attr('rdf:resource'),
        target: $(targetRange).attr('rdf:resource'),
        sourceType: domainSplit[1],
        targetType: rangeSplit[1]
      };
      allRelationTypes.push(splitAbout[1].toLowerCase());
      result.schema.edges.push(relation);
    })

    // get all instance

    $(`owl\\:NamedIndividual`).each((index, ele) => {
      let instanceAbout = $(ele).attr('rdf:about');
      let typeRdf = $(ele).find('rdf\\:type').first();
      let label = $(ele).find('rdfs\\:hasLabel').first().text();
      let node = {
        id: instanceAbout,
        label: label,
        type: typeRdf.attr('rdf:resource')
      }

      // console.log($(ele).)
      // if()

      result.kg.nodes.push(node);

      if ($(ele).find('[rdf\\:resource]').length > 1) {
        $(ele).find('[rdf\\:resource]').each((index, child) => {
          let tagName = $(child).prop('tagName').toLowerCase();
          if (allRelationTypes.indexOf(tagName) >= 0) {
            let targetAbout = $(child).attr('rdf:resource');
            let relationModel = result.schema.edges.find(rel => rel.label.toLowerCase() === tagName)
            let relation = {
              id: `${parseUrl(instanceAbout)[1]}___${relationModel.label}___${parseUrl(targetAbout)[1]}`,
              source: instanceAbout,
              target: targetAbout,
              type: relationModel.id,
              label: relationModel.label
            }
            result.kg.edges.push(relation);
          }
        })
      }
    })

    res.json(result);

  })

})

function parseUrl(url) {
  return url.split('#');
}


module.exports = router;