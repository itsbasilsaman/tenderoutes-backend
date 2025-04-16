 
 

const express = require('express')
const multer = require('multer')
const Section = require('../models/homeSection')
const fs = require('fs');
const {v2:cloudinary} = require('cloudinary')
const { CloudinaryStorage} = require('multer-storage-cloudinary')
const router = express.Router();


try {
  cloudinary.config({
    cloud_name: 'tenderoutes',
    api_key: '962426731954725',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'your-api-secret-here', // Use environment variable
    secure: true
  });
  
  // Test Cloudinary connection
  cloudinary.api.ping()
    .then(() => console.log('Connected to Cloudinary successfully'))
    .catch(err => console.error('Cloudinary connection failed:', err));
} catch (err) {
  console.error('Cloudinary config error:', err);
}

// Enhanced storage configuration with error handling
const storage = new multer.diskStorage({
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.match(/^image\/(jpg|jpeg|png|webp)$/)) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});



// GET All sections
router.get('/', async (req,res) => {
  const sections = await Section.find()
  console.log(`12345`,sections)
  res.json(sections);
});

// Create a new section
router.post('/', upload.single('image'), async (req, res) => {
  try {
    console.log('Request received with body:', req.body);
    console.log('Uploaded file:', req.file);

    const { titleEn, titleAr, descriptionEn, descriptionAr } = req.body;

    // Validation
    if (!titleEn || !titleAr || !descriptionEn || !descriptionAr) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    let imageUrl = null;
    let imagePublicId = null;

    // Handle file upload to Cloudinary if file exists
    if (req.file) {
      try {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'tenderoutes-sections',
          transformation: { width: 1000, height: 700, crop: 'limit' }
        });
        
        imageUrl = result.secure_url;
        imagePublicId = result.public_id;
        
        // Delete the temporary file
        fs.unlinkSync(req.file.path);
      } catch (uploadErr) {
        console.error('Cloudinary upload error:', uploadErr);
        return res.status(500).json({ 
          error: 'Failed to upload image',
          details: uploadErr.message 
        });
      }
    }

    // Create new section
    const newSection = new Section({
      title: { en: titleEn, ar: titleAr },
      description: { en: descriptionEn, ar: descriptionAr },
      imageUrl,
      imagePublicId
    });

    const savedSection = await newSection.save();
    console.log('Section saved successfully:', savedSection);
    
    res.status(201).json(savedSection);
  } catch (error) {
    console.error('Full error stack:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
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
 try {
  const section = await Section.findById(req.params.id)
  if(!section) return res.status(404).send("Not Found");

 if(section.imagePublicId){
  await cloudinary.uploader.destroy(section.imagePublicId)
 }

  await Section.deleteOne({_id: req.params.id})
  res.json({message: "Deleted"});
 } catch(error) {
  console.error(error)
  res.status(500).send("Server Error")
 }
})

module.exports = router


