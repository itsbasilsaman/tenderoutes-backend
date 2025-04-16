 
 

const express = require('express')
const multer = require('multer')
const Section = require('../models/homeSection')
const fs = require('fs');
 
const router = express.Router();

const storage = multer.diskStorage({
  destination: (req,file, cb) => cb(null, 'uploads/'),
  filename: (req,file,cb) => cb(null, Date.now() + '-' + file.originalname)
});

const upload = multer({storage});



// GET All sections
router.get('/', async (req,res) => {
  const sections = await Section.find()
  console.log(`12345`,sections)
  res.json(sections);
});

// Create a new section
router.post('/', upload.single('image'), async (req, res) => {
  const { titleEn, titleAr, descriptionEn, descriptionAr } = req.body;

  const newSection = new Section({
    title: {
      en: titleEn,
      ar: titleAr
    },
    description: {
      en: descriptionEn,
      ar: descriptionAr
    },
    imageUrl: req.file ? `/uploads/${req.file.filename}` : null
  });

  await newSection.save();
  res.status(201).json(newSection);
});


// Update a section
router.put('/:id', upload.single('image'), async( req, res) => {
  const {titleEn, titleAr, descriptionEn, descriptionAr} = req.body;
  const section = await Section.findById(req.params.id);

  if(req.file && section.imageUrl){
    fs.unlinkSync(`.${section.imageUrl}`)
  }

  section.title.en = titleEn;
  section.title.ar = titleAr;
  section.description.en = descriptionEn;
  section.description.ar = descriptionAr;
  if(req.file) section.imageUrl = `/uploads/${req.file.filename}`

  await section.save();
  res.json(section);
})


// Delete a section 
router.delete('/:id', async(req,res) => {
  const section = await Section.findById(req.params.id)
  if(!section) return res.status(404).send("Not Found");

  if(section.imageUrl) {
    fs.unlinkSync(`.${section.imageUrl}`)
  }

  await section.remove()
  res.json({message: "Deleted"});

})

module.exports = router


