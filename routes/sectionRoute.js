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
  try {
    const package = await Package.findById(req.params.id);
    if (!package) return res.status(404).json({ error: 'Package not found' });

    // Update all possible fields
    const fieldsToUpdate = [
      'packageType', 'nights', 'days', 'rating', 'reviewsCount', 'discount',
      'price', 'originalPrice', 'metaTitleEn', 'metaTitleAr', 'metaDescriptionEn',
      'metaDescriptionAr', 'metaKeywordsEn', 'metaKeywordsAr', 'canonicalUrl',
      'slugEn', 'slugAr'
    ];

    fieldsToUpdate.forEach(field => {
      if (req.body[field] !== undefined) {
        // Handle nested fields
        if (field.includes('En') || field.includes('Ar')) {
          const [parent, lang] = field.split(/(?=[A-Z])/);
          const parentField = parent.toLowerCase();
          package[parentField][lang.toLowerCase()] = req.body[field];
        } else {
          package[field] = req.body[field];
        }
      }
    });

    // Handle boolean fields
    if (req.body.isFeatured !== undefined) {
      package.isFeatured = req.body.isFeatured === 'true';
    }

    // Handle title and description
    if (req.body.titleEn) package.title.en = req.body.titleEn;
    if (req.body.titleAr) package.title.ar = req.body.titleAr;
    if (req.body.descriptionEn) package.description.en = req.body.descriptionEn;
    if (req.body.descriptionAr) package.description.ar = req.body.descriptionAr;
    if (req.body.destinationsEn) package.destinations.en = req.body.destinationsEn;
    if (req.body.destinationsAr) package.destinations.ar = req.body.destinationsAr;

    // Handle image uploads
    if (req.files?.image) {
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
    }

    // Handle OG image upload
    if (req.files?.ogImage) {
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
    }

    // Handle JSON fields
    const jsonFields = ['itinerary', 'inclusions', 'exclusions', 'overview', 'highlights', 'faqs'];
    jsonFields.forEach(field => {
      if (req.body[field]) {
        try {
          package[field === 'overview' ? field : `details.${field}`] = 
            typeof req.body[field] === 'string' ? JSON.parse(req.body[field]) : req.body[field];
        } catch (err) {
          console.error(`Error parsing ${field}:`, err);
          return res.status(400).json({ error: `Invalid ${field} format` });
        }
      }
    });

    package.updatedAt = Date.now();
    const updatedPackage = await package.save();
    res.json(updatedPackage);
  } catch (error) {
    console.error('Error updating package:', error);
    res.status(500).json({ 
      error: 'Failed to update package',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
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