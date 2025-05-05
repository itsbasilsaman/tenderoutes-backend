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
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const package = await Package.findById(req.params.id);
    if (!package) return res.status(404).json({ error: 'Package not found' });

    // Update fields from request body
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
      
      metaTitleEn, metaTitleAr,
      metaDescriptionEn, metaDescriptionAr,
      metaKeywordsEn, metaKeywordsAr,
      canonicalUrl,
      overview
    } = req.body;

    if (packageType) package.packageType = packageType;
    if (titleEn) package.title.en = titleEn;
    if (titleAr) package.title.ar = titleAr;
    if (descriptionEn) package.description.en = descriptionEn;
    if (descriptionAr) package.description.ar = descriptionAr;
    if (nights) package.duration.nights = parseInt(nights);
    if (days) package.duration.days = parseInt(days);
    if (destinationsEn) package.destinations.en = destinationsEn;
    if (destinationsAr) package.destinations.ar = destinationsAr;
    if (rating) package.rating = parseFloat(rating);
    if (reviewsCount) package.reviewsCount = parseInt(reviewsCount);
    if (discount) package.discount = parseInt(discount);
    if (isFeatured) package.isFeatured = isFeatured === 'true';
    // For PUT:
if (metaTitleEn) package.metaTitle.en = metaTitleEn;
if (metaTitleAr) package.metaTitle.ar = metaTitleAr;
if (metaDescriptionEn) package.metaDescription.en = metaDescriptionEn;
if (metaDescriptionAr) package.metaDescription.ar = metaDescriptionAr;
if (metaKeywordsEn) package.metaKeywords.en = metaKeywordsEn;
if (metaKeywordsAr) package.metaKeywords.ar = metaKeywordsAr;
if (canonicalUrl) package.canonicalUrl = canonicalUrl;

    // Handle image update
    if (req.file) {
      try {
        // Delete old image if exists
        if (package.imagePublicId) {
          await cloudinary.uploader.destroy(package.imagePublicId);
        }

        // Upload new image
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'tenderoutes-packages',
          transformation: { width: 1000, height: 700, crop: 'limit' }
        });

        package.imageUrl = result.secure_url;
        package.imagePublicId = result.public_id;
        fs.unlinkSync(req.file.path);
      } catch (uploadErr) {
        console.error('Cloudinary upload error:', uploadErr);
        return res.status(500).json({ 
          error: 'Failed to update image',
          details: uploadErr.message 
        });
      }
    }

    // Handle OG image upload (similar to main image)
if (req.files?.ogImage) {
  // Upload logic similar to main image
  package.ogImage = result.secure_url;
  package.ogImagePublicId = result.public_id;
}

    // Update details if provided
    if (itinerary) {
      try {
        package.details.itinerary = typeof itinerary === 'string' ? JSON.parse(itinerary) : itinerary;
      } catch (err) {
        console.error('Error parsing itinerary:', err);
        return res.status(400).json({ error: 'Invalid itinerary format' });
      }
    }
    
    if (inclusions) {
      try {
        package.details.inclusions = typeof inclusions === 'string' ? JSON.parse(inclusions) : inclusions;
      } catch (err) {
        console.error('Error parsing inclusions:', err);
        return res.status(400).json({ error: 'Invalid inclusions format' });
      }
    }
    
    if (exclusions) {
      try {
        package.details.exclusions = typeof exclusions === 'string' ? JSON.parse(exclusions) : exclusions;
      } catch (err) {
        console.error('Error parsing exclusions:', err);
        return res.status(400).json({ error: 'Invalid exclusions format' });
      }
    }

    // Similarly in the PUT route:
if (overview) {
  try {
    package.overview = typeof overview === 'string' ? JSON.parse(overview) : overview;
  } catch (err) {
    console.error('Error parsing overview:', err);
    return res.status(400).json({ error: 'Invalid overview format' });
  }
}

if (highlights) {
  try {
    package.highlights = typeof highlights === 'string' ? JSON.parse(highlights) : highlights;
  } catch (err) {
    console.error('Error parsing highlights:', err);
    return res.status(400).json({ error: 'Invalid highlights format' });
  }
}

if (faqs) {
  try {
    package.faqs = typeof faqs === 'string' ? JSON.parse(faqs) : faqs;
  } catch (err) {
    console.error('Error parsing faqs:', err);
    return res.status(400).json({ error: 'Invalid faqs format' });
  }
}
    
    if (price) package.details.price = parseFloat(price);
    if (originalPrice) package.details.originalPrice = parseFloat(originalPrice);

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