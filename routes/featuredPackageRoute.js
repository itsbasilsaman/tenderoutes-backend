const express = require('express');
const router = express.Router();
const FeaturedPackage = require('../models/featuredPackage');
const Package = require('../models/package');

// Get all featured packages
router.get('/', async (req, res) => {
  try {
    const featuredPackages = await FeaturedPackage.find({ isActive: true })
      .populate('package')
      .sort({ order: 1 });
      
    res.json(featuredPackages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add package to featured section
router.post('/', async (req, res) => {
  try {
    const { packageId, title, subtitle, destinationsCount } = req.body;
    
    // Validate input
    if (!packageId || !title || !subtitle || !destinationsCount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check if package exists
    const package = await Package.findById(packageId);
    if (!package) {
      return res.status(404).json({ error: 'Package not found' });
    }
    
    // Create new featured package
    const featuredPackage = new FeaturedPackage({
      package: packageId,
      title,
      subtitle,
      destinationsCount
    });
    
    await featuredPackage.save();
    
    res.status(201).json(featuredPackage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update featured package
router.put('/:id', async (req, res) => {
  try {
    const { title, subtitle, destinationsCount, order, isActive } = req.body;
    
    const featuredPackage = await FeaturedPackage.findByIdAndUpdate(
      req.params.id,
      { title, subtitle, destinationsCount, order, isActive },
      { new: true }
    );
    
    if (!featuredPackage) {
      return res.status(404).json({ error: 'Featured package not found' });
    }
    
    res.json(featuredPackage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove package from featured section
router.delete('/:id', async (req, res) => {
  try {
    const featuredPackage = await FeaturedPackage.findByIdAndDelete(req.params.id);
    
    if (!featuredPackage) {
      return res.status(404).json({ error: 'Featured package not found' });
    }
    
    res.json({ message: 'Featured package removed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;