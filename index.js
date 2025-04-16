 
 
 

const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const router = require('./routes/sectionRoutes')

const db = require('./db/connection')

const app = express()
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());
app.use('/uploads', express.static('uploads'))
app.use('/api/sections', router)


app.listen(PORT , () => {
  console.log(`Server running on the PORT ${PORT}`);
})