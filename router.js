const express = require('express')
const fs = require('fs');
const dataStore = require('./utils/DataStore')

async function getRouter() {
  await dataStore.init()
  const router = express.Router()
  router.get('/states', async function (req, res) {
    try {
      const data = dataStore.getAllStateData()
      // .sort((a, b) => {
      //   return a.vulnerability - b.vulnerability
      // })
      res.json(data)
    } catch(e) {
      console.log(e)
      res.status(500)
    }
  })
  return router
}

module.exports = getRouter
