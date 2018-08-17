var express = require('express');
var router = express.Router();
var multer = require('multer')
var upload = multer({
  dest: 'uploads/'
})

const cheerio = require('cheerio');
var builder = require('xmlbuilder');
var fs = require('fs');
var path = require('path');

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
    root: {
      tag: 'rdf:RDF',
      attr: {
        'xmlns': '',
        'xml:base': '',
        'xmlns:it-kg': '',
        'xmlns:rdf': '',
        'xmlns:owl': '',
        'xmlns:xml': '',
        'xmlns:xsd': '',
        'xmlns:rdfs': ''
      }
    },
    ontology: {
      tag: 'owl:Ontology',
      attr: {
        'rdf:about': ''
      }
    },
    properties: [

    ],
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
    let root = $('rdf\\:RDF');
    let ontology = $('owl\\:Ontology');
    for (const attr in result.root.attr) {
      if (result.root.attr.hasOwnProperty(attr)) {
        result.root.attr[attr] = root.attr(attr);
      }
    }

    for (const attr in result.ontology.attr) {
      if (result.ontology.attr.hasOwnProperty(attr)) {
        result.ontology.attr[attr] = ontology.attr(attr);
      }
    }


    // get all annotationproperties
    $(`owl\\:AnnotationProperty`).each((index, ele) => {
      result.properties.push({
        tag: 'owl:AnnotationProperty',
        id: $(ele).attr('rdf:about')
      })
    })

    // get all kinds of models
    $(`owl\\:Class`).each((index, ele) => {
      let about = $(ele).attr('rdf:about');
      let node = {
        id: about,
        label: parseUrl(about)[1],
        tag: 'owl:Class',
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
        tag: 'owl:ObjectProperty',
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
        type: typeRdf.attr('rdf:resource'),
        tag: 'owl:NamedIndividual'
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
              label: relationModel.label,
              tag: relationModel.label
            }
            result.kg.edges.push(relation);
          }
        })
      }
    })

    res.json(result);

  })

})


router.post('/api/json2owl', function (req, res, next) {

  let {
    root,
    ontology,
    properties,
    schema,
    kg
  } = req.body;
  var rootXml = builder.create(root.tag);
  for (const attr in root.attr) {
    if (root.attr.hasOwnProperty(attr)) {
      const element = root.attr[attr];
      rootXml.attribute(attr, element)
    }
  }

  let ontologyXml = rootXml.ele(ontology.tag);
  for (const attr in ontology.attr) {
    if (ontology.attr.hasOwnProperty(attr)) {
      const element = ontology.attr[attr];
      ontologyXml.attribute(attr, element)
    }
  }

  properties.forEach(propterty => {
    rootXml.ele(propterty.tag)
      .attribute('rdf:about', propterty.id)
  });

  schema.edges.forEach(edge => {
    let schemaEdgeXml = rootXml.ele(edge.tag);
    schemaEdgeXml.attribute('rdf:about', edge.id)
    schemaEdgeXml.ele('rdfs:domain').attribute('rdf:resource', edge.source)
    schemaEdgeXml.ele('rdfs:range').attribute('rdf:resource', edge.target)
  });

  schema.nodes.forEach(node => {
    rootXml.ele(node.tag)
      .attribute('rdf:about', node.id)
  })

  kg.nodes.forEach(node => {
    let kgNodeXml = rootXml.ele(node.tag);
    kgNodeXml.attribute('rdf:about', node.id);
    kgNodeXml.ele('rdf:type').attribute('rdf:resource', node.type);
    let relations = kg.edges.filter(edge => edge.source === node.id);

    relations.forEach(rel => {
      kgNodeXml.ele(rel.tag).attribute('rdf:resource', rel.target)
    })

    kgNodeXml.ele('rdfs:hasLabel')
      .attribute('rdf:datatype', 'http://www.w3.org/2001/XMLSchema#string')
      .text(node.label)
  })

  var temFile = fs.createWriteStream(`uploads/${new Date().getTime()}.owl`)
  temFile.write(rootXml.end({
    pretty: true
  }), 'utf-8')
  temFile.end();
  temFile.on('finish', () => {
    res.json({
      path: temFile.path
    })
  })
})

router.get('/api/downloadowl', function (req, res, next) {
  console.log(req.query);
  let filePath = path.resolve(__dirname, '../', req.query.filepath)
  res.download(filePath);
})

function parseUrl(url) {
  return url.split('#');
}


module.exports = router;