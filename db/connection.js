const mongoose = require('mongoose')

const connectionString = 'mongodb+srv://itsbasilsaman:Luminar@cluster0.z2dectl.mongodb.net/TendroutesBackend?retryWrites=true&w=majority&appName=Cluster0'

mongoose.connect(connectionString).then(res => {
  console.log(`Server is connected to DB ${res}`);
  
}).catch(err => {
  console.log(`Error ${err}`)
})






