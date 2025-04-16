 
 

const express = require('express')
const multer = require('multer')
const Section = require('../models/homeSection')
const fs = require('fs');
const {v2:cloudinary} = require('cloudinary')
const { CloudinaryStorage} = require('multer-storage-cloudinary')
const router = express.Router();



cloudinary.config({
  cloud_name: 'tenderoutes',
  api_key: '962426731954725',
  api_secret: 'AlyIKGASf0T3FgrIgqELSml89-w',
});

// Multer + Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'tenderoutes-sections',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    transformation: [{ width: 1000, height: 700, crop: 'limit' }],
  },
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
    imageUrl: req.file?.path || null,
    imagePublicId: req.file?.filename || null,
  });

  await newSection.save();
  res.status(201).json(newSection);
});


// Update a section
router.put('/:id', upload.single('image'), async( req, res) => {
  const {titleEn, titleAr, descriptionEn, descriptionAr} = req.body;
  const section = await Section.findById(req.params.id);

 if(!section) return res.status(404).send('Section not found');

 if(req.file && section.imagePublicId){
  await cloudinary.uploader.destroy(section.imagePublicId)
 }

  section.title.en = titleEn;
  section.title.ar = titleAr;
  section.description.en = descriptionEn;
  section.description.ar = descriptionAr;
  if(req.file)  {
    section.imageUrl = req.file.path;
    section.imagePublicId = req.file.filename
  }
  await section.save();
  res.json(section);
})


// Delete a section 
router.delete('/:id', async(req,res) => {
  const section = await Section.findById(req.params.id)
  if(!section) return res.status(404).send("Not Found");

 if(section.imagePublicId){
  await cloudinary.uploader.destroy(section.imagePublicId)
 }

  await section.remove()
  res.json({message: "Deleted"});

})

module.exports = router


