const mongoose = require('mongoose')

const sectionSchema = new mongoose.Schema({
  title: {
    en: String,
    ar: String
  },
  description: {
    en: String,
    ar: String
  },
  imageUrl :String
});


module.exports =  mongoose.model("Section", sectionSchema)