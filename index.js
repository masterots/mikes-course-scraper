const fs = require('fs');
const PDFParser = require('pdf2json');
const path = require('path');
const equal = require('fast-deep-equal');
const {Parser} = require('json2csv');

const sectionRegExp = new RegExp(/^(.*)%20-%20(.*)%20-%20(.*)%20-%20([0-9]*)$/, 'i');
const pdfParser = new PDFParser();

pdfParser.on("pdfParser_dataError", (errData) => console.error(errData.parserError));

pdfParser.on("pdfParser_dataReady", (pdfData) => {
  const texts = pdfData.formImage.Pages.reduce((collector, page) => {
    collector.push(...page.Texts);

    return collector;
  }, []);

  let lastCourse = {};
  let i = 0;
  let getCountColumn = false;
  let data = [];

  while (i < texts.length) {
    const text = texts[i].R[0].T;
    const sectionResult = sectionRegExp.exec(text);
    
    let nextCourse = lastCourse;

    if (sectionResult) {
      const [_, courseName, crn, courseNumber, section] = sectionResult;
      nextCourse = {
        courseName: courseName
          .replace(/%E2%80%94/g, ' - ')
          .replace(/%E2%80%99/g, '\'')
          .replace(/%20/g, ' ')
          .replace(/%2C/g, ','),
        crn,
        courseNumber: courseNumber.replace(/%20/g, ' '),
        section,
      };

      getCountColumn = false;
    }

    if (!equal(lastCourse, nextCourse)) {
      lastCourse = nextCourse;
    }

    const isClassColumn = /^class$/i.test(text);
    
    if (isClassColumn) {
      getCountColumn = true;
    }

    if (getCountColumn) {
      const isNumber = /^[0-9]*$/.test(text);

      if (isNumber && parseInt(text, 10) < 100) {
        data.push({
          ...lastCourse,
          remainingSeats: parseInt(text, 10),
        });
        getCountColumn = false;
      }
    }

    i++;
  }

  const fields = ['courseName', 'crn', 'courseNumber', 'section', 'remainingSeats'];
  const opts = {fields};
  
  try {
    const parser = new Parser(opts);
    const csv = parser.parse(data);

    fs.writeFile(`${path.join(__dirname, 'class-schedule.csv')}`, csv, (err) => {
      if (err) {
        throw err;
      }

      console.log('saved');
    });
  } catch (err) {
    console.error(err);
  }
});

pdfParser.loadPDF(`${path.join(__dirname, 'class-schedule.pdf')}`);
