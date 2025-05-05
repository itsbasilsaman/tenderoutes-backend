const mongoose = require('mongoose');


const featuredPackageSchema = new mongoose.Schema({
  package: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Package',
    required: true
  },
  title: {
    en: { type: String, required: true },
    ar: { type: String, required: true }
  },
  subtitle: {
    en: { type: String, required: true },
    ar: { type: String, required: true }
  },
  destinationsCount: {
    type: String,
    required: true
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('FeaturedPackage', featuredPackageSchema);