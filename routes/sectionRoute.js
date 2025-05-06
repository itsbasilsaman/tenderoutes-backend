const express = require('express');
const multer = require('multer');
const Package = require('../models/package');
const fs = require('fs');
const { v2: cloudinary } = require('cloudinary');
const router = express.Router({ mergeParams: true });

// Cloudinary Configuration
try {
  cloudinary.config({
    cloud_name: 'dleiconw0',
    api_key: '962426731954725',
    api_secret:  process.env.CLOUDINARY_API_SECRET || 'AlyIKGASf0T3FgrIgqELSml89-w',
    secure: true
  });
  
  // Test Cloudinary connection
  cloudinary.api.ping()
    .then(() => console.log('Connected to Cloudinary successfully'))
    .catch(err => console.error('Cloudinary connection failed:', err));
} catch (err) {
  console.error('Cloudinary config error:', err);
}

// Configure disk storage for temporarily storing uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = './uploads';
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
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


// GET package by slug
router.get('/slug/:slug', async (req, res) => {
  try {
    const package = await Package.findOne({ 
      $or: [
        { 'slug.en': req.params.slug },
        { 'slug.ar': req.params.slug }
      ]
    });
    
    if (!package) return res.status(404).json({ error: 'Package not found' });
    res.json(package);
  } catch (error) {
    console.error('Error fetching package by slug:', error);
    res.status(500).json({ error: 'Failed to fetch package' });
  }
});

// GET All packages with optional filtering
router.get('/', async (req, res) => {
  try {
    const { type, featured, limit } = req.query;
    let query = {};
    
    if (type) query.packageType = type;
    if (featured) query.isFeatured = featured === 'true';
    
    let packages = Package.find(query);
    
    if (limit) packages = packages.limit(parseInt(limit));
    
    const results = await packages.sort({ createdAt: -1 }).exec();
    res.json(results);
  } catch (error) {
    console.error('Error fetching packages:', error);
    res.status(500).json({ error: 'Failed to fetch packages' });
  }
});

// GET Single package by ID
router.get('/:id', async (req, res) => {
  try {
    const package = await Package.findById(req.params.id);
    if (!package) return res.status(404).json({ error: 'Package not found' });
    res.json(package);
  } catch (error) {
    console.error('Error fetching package:', error);
    res.status(500).json({ error: 'Failed to fetch package' });
  }
});

router.post('/', upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'ogImage', maxCount: 1 }
]), async (req, res) => {
  try {
    // Extract all fields from req.body
    const {
      packageType,
      titleEn, titleAr,
      descriptionEn, descriptionAr,
      nights, days,
      destinationsEn, destinationsAr,
      rating, reviewsCount,
      discount, isFeatured,
      itinerary, inclusions, exclusions,
      price, originalPrice,
      overview,
      highlights,
      faqs,
      metaTitleEn, metaTitleAr,
      metaDescriptionEn, metaDescriptionAr,
      metaKeywordsEn, metaKeywordsAr,
      canonicalUrl,
      slugEn, slugAr
    } = req.body;

    // Basic validation
    if (!packageType || !titleEn || !titleAr) {
      return res.status(400).json({ error: 'Required fields are missing' });
    }

    // Handle image uploads
    let imageUrl, imagePublicId, ogImageUrl, ogImagePublicId;

    if (req.files?.image) {
      const result = await cloudinary.uploader.upload(req.files.image[0].path, {
        folder: 'tenderoutes-packages'
      });
      imageUrl = result.secure_url;
      imagePublicId = result.public_id;
      fs.unlinkSync(req.files.image[0].path);
    }

    if (req.files?.ogImage) {
      const result = await cloudinary.uploader.upload(req.files.ogImage[0].path, {
        folder: 'tenderoutes-packages/og-images'
      });
      ogImageUrl = result.secure_url;
      ogImagePublicId = result.public_id;
      fs.unlinkSync(req.files.ogImage[0].path);
    }

    // Create new package
    const newPackage = new Package({
      packageType,
      title: { en: titleEn, ar: titleAr },
      description: { en: descriptionEn, ar: descriptionAr },
      duration: { nights: parseInt(nights), days: parseInt(days) },
      destinations: { en: destinationsEn, ar: destinationsAr },
      rating: rating ? parseFloat(rating) : 0,
      reviewsCount: reviewsCount ? parseInt(reviewsCount) : 0,
      discount: discount ? parseInt(discount) : 0,
      isFeatured: isFeatured === 'true',
      imageUrl,
      imagePublicId,
      ogImage: ogImageUrl,
      ogImagePublicId,
      details: {
        itinerary: tryParseJSON(itinerary) || [],
        inclusions: tryParseJSON(inclusions) || [],
        exclusions: tryParseJSON(exclusions) || [],
        price: price ? parseFloat(price) : 0,
        originalPrice: originalPrice ? parseFloat(originalPrice) : 0
      },
      overview: tryParseJSON(overview) || { en: '', ar: '' },
      highlights: tryParseJSON(highlights) || [],
      faqs: tryParseJSON(faqs) || [],
      metaTitle: { en: metaTitleEn, ar: metaTitleAr },
      metaDescription: { en: metaDescriptionEn, ar: metaDescriptionAr },
      metaKeywords: { en: metaKeywordsEn, ar: metaKeywordsAr },
      canonicalUrl,
      slug: { en: slugEn, ar: slugAr }
    });

    const savedPackage = await newPackage.save();
    res.status(201).json(savedPackage);
  } catch (error) {
    console.error('Error creating package:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Helper function to safely parse JSON
function tryParseJSON(jsonString) {
  try {
    if (typeof jsonString === 'string') {
      return JSON.parse(jsonString);
    }
    return jsonString;
  } catch (e) {
    return null;
  }
}

// UPDATE Package
router.put('/:id', upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'ogImage', maxCount: 1 }
]), async (req, res) => {
  console.log('PUT request received for package:', req.params.id);
  console.log('Request body fields:', Object.keys(req.body));
  console.log('Request files:', req.files);

  try {
    const package = await Package.findById(req.params.id);
    if (!package) {
      console.log('Package not found:', req.params.id);
      return res.status(404).json({ error: 'Package not found' });
    }

    console.log('Existing package found:', package._id);

    // Update all fields from request body
    const updateFields = [
      'packageType', 'titleEn', 'titleAr', 'descriptionEn', 'descriptionAr',
      'nights', 'days', 'destinationsEn', 'destinationsAr', 'rating',
      'reviewsCount', 'discount', 'isFeatured', 'price', 'originalPrice',
      'metaTitleEn', 'metaTitleAr', 'metaDescriptionEn', 'metaDescriptionAr',
      'metaKeywordsEn', 'metaKeywordsAr', 'canonicalUrl', 'slugEn', 'slugAr'
    ];

    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        console.log(`Updating field ${field} with value:`, req.body[field]);
        // Handle nested fields
        if (field.endsWith('En') || field.endsWith('Ar')) {
          const baseField = field.replace(/En$|Ar$/, '');
          const lang = field.slice(-2).toLowerCase();
          if (!package[baseField]) package[baseField] = {};
          package[baseField][lang] = req.body[field];
        } else {
          package[field] = req.body[field];
        }
      }
    });

    // Handle boolean fields
    if (req.body.isFeatured !== undefined) {
      package.isFeatured = req.body.isFeatured === 'true';
    }

    // Handle image uploads
    if (req.files?.image) {
      console.log('Processing image upload...');
      try {
        // Delete old image if exists
        if (package.imagePublicId) {
          await cloudinary.uploader.destroy(package.imagePublicId);
        }

        // Upload new image
        const result = await cloudinary.uploader.upload(req.files.image[0].path, {
          folder: 'tenderoutes-packages'
        });
        package.imageUrl = result.secure_url;
        package.imagePublicId = result.public_id;
        fs.unlinkSync(req.files.image[0].path);
        console.log('Image updated successfully');
      } catch (uploadError) {
        console.error('Image upload failed:', uploadError);
        throw uploadError;
      }
    }

    // Handle OG image upload
    if (req.files?.ogImage) {
      console.log('Processing OG image upload...');
      try {
        // Delete old OG image if exists
        if (package.ogImagePublicId) {
          await cloudinary.uploader.destroy(package.ogImagePublicId);
        }

        // Upload new OG image
        const result = await cloudinary.uploader.upload(req.files.ogImage[0].path, {
          folder: 'tenderoutes-packages/og-images'
        });
        package.ogImage = result.secure_url;
        package.ogImagePublicId = result.public_id;
        fs.unlinkSync(req.files.ogImage[0].path);
        console.log('OG image updated successfully');
      } catch (uploadError) {
        console.error('OG image upload failed:', uploadError);
        throw uploadError;
      }
    }

    // Handle JSON fields
    const jsonFields = ['itinerary', 'inclusions', 'exclusions', 'overview', 'highlights', 'faqs'];
    jsonFields.forEach(field => {
      if (req.body[field]) {
        console.log(`Processing JSON field ${field}...`);
        try {
          const parsedValue = typeof req.body[field] === 'string' ? 
            JSON.parse(req.body[field]) : 
            req.body[field];
          
          if (field === 'overview') {
            package.overview = parsedValue;
          } else {
            package.details[field] = parsedValue;
          }
        } catch (err) {
          console.error(`Error parsing ${field}:`, err);
          throw new Error(`Invalid ${field} format`);
        }
      }
    });

    package.updatedAt = Date.now();
    console.log('Saving updated package...');
    const updatedPackage = await package.save();
    console.log('Package updated successfully:', updatedPackage._id);
    res.json(updatedPackage);
  } catch (error) {
    console.error('Full error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to update package',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// DELETE Package
router.delete('/:id', async (req, res) => {
  try {
    const package = await Package.findById(req.params.id);
    if (!package) return res.status(404).json({ error: 'Package not found' });

    // Delete image from Cloudinary if exists
    if (package.imagePublicId) {
      await cloudinary.uploader.destroy(package.imagePublicId);
    }

    await Package.deleteOne({ _id: req.params.id });
    res.json({ message: "Package deleted successfully" });
  } catch (error) {
    console.error('Error deleting package:', error);
    res.status(500).json({ 
      error: 'Failed to delete package',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;