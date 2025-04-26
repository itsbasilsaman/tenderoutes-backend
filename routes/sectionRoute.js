const express = require('express');
const multer = require('multer');
const Package = require('../models/package');
const fs = require('fs');
const { v2: cloudinary } = require('cloudinary');
const router = express.Router();

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

// CREATE New package
router.post('/', upload.single('image'), async (req, res) => {
  try {
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
  faqs
    } = req.body;

    // Basic validation
    if (!packageType || !titleEn || !titleAr || !descriptionEn || !descriptionAr || 
        !nights || !days || !destinationsEn || !destinationsAr) {
      return res.status(400).json({ error: 'Required fields are missing' });
    }

    let imageUrl = null;
    let imagePublicId = null;

    // Handle image upload
    if (req.file) {
      try {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'tenderoutes-packages',
          transformation: { width: 1000, height: 700, crop: 'limit' }
        });
        
        imageUrl = result.secure_url;
        imagePublicId = result.public_id;
        fs.unlinkSync(req.file.path);
      } catch (uploadErr) {
        console.error('Cloudinary upload error:', uploadErr);
        return res.status(500).json({ 
          error: 'Failed to upload image',
          details: uploadErr.message 
        });
      }
    }

    // Parse itinerary, inclusions, exclusions if they're strings
    let parsedItinerary = itinerary;
    let parsedInclusions = inclusions;
    let parsedExclusions = exclusions;
    
    try {
      if (typeof itinerary === 'string') parsedItinerary = JSON.parse(itinerary);
      if (typeof inclusions === 'string') parsedInclusions = JSON.parse(inclusions);
      if (typeof exclusions === 'string') parsedExclusions = JSON.parse(exclusions);
    } catch (parseErr) {
      console.error('Error parsing JSON fields:', parseErr);
      return res.status(400).json({ error: 'Invalid JSON in itinerary/inclusions/exclusions' });
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
      details: {
        itinerary: parsedItinerary || [],
        inclusions: parsedInclusions || [],
        exclusions: parsedExclusions || [],
        price: price ? parseFloat(price) : 0,
        originalPrice: originalPrice ? parseFloat(originalPrice) : 0
      },
      overview: typeof overview === 'string' ? JSON.parse(overview) : overview,
      highlights: typeof highlights === 'string' ? JSON.parse(highlights) : highlights,
      faqs: typeof faqs === 'string' ? JSON.parse(faqs) : faqs
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
      price, originalPrice
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