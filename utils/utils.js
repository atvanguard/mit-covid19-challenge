const csv = require('csv-parser')
const fs = require('fs')
const assert = require('assert')

function parseCsv(fileName) {
  const results = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(fileName)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      // console.log(results)
      resolve(results)
    })
  })
}

module.exports = { parseCsv }
