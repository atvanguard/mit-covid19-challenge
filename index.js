const express = require('express')
const app = express()
const getRouter = require('./router')
const port = 3000

getRouter().then(router => {
  app.use('/', router)
  app.listen(port, () => console.log(`app listening at http://localhost:${port}`))
})
