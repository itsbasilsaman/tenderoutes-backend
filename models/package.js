const mongoose = require('mongoose');
const slugify = require('slugify');
const packageSchema = new mongoose.Schema({
  packageType: {
    type: String,
    enum: ['standard', 'premium', 'luxury'],
    required: true
  },
  
   // Add these new fields
   metaTitle: {
    en: { type: String },
    ar: { type: String }
  },
  metaDescription: {
    en: { type: String },
    ar: { type: String }
  },
  metaKeywords: {
    en: { type: String },
    ar: { type: String }
  },
  slug: {
    en: { type: String, unique: true },
    ar: { type: String, unique: true }
  },
  ogImage: String,
  ogImagePublicId: String,
  canonicalUrl: String,
  title: {
    en: { type: String, required: true },
    ar: { type: String, required: true }
  },
  description: {
    en: { type: String, required: true },
    ar: { type: String, required: true }
  },
  duration: {
    nights: { type: Number, required: true },
    days: { type: Number, required: true }
  },
  destinations: {
    en: { type: String, required: true },
    ar: { type: String, required: true }
  },
  rating: { type: Number, min: 0, max: 5, default: 0 },
  reviewsCount: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  isFeatured: { type: Boolean, default: false },
  imageUrl: String,
  imagePublicId: String,
  details: {
    itinerary: [{
      day: Number,
      title: { en: String, ar: String },
      description: { en: String, ar: String },
      activities: [{ en: String, ar: String }]
    }],
    inclusions: [{ en: String, ar: String }],
    exclusions: [{ en: String, ar: String }],
    price: Number,
    originalPrice: Number
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  overview: {
    en: String,
    ar: String
  },
  highlights: [{
    en: String,
    ar: String
  }],
  faqs: [{
    question: {
      en: String,
      ar: String
    },
    answer: {
      en: String,
      ar: String
    }
  }]
});


// Pre-save hook to generate slugs
packageSchema.pre('save', function(next) {
  if (this.isModified('title.en')) {
    this.slug.en = slugify(this.title.en, { lower: true, strict: true });
  }
  if (this.isModified('title.ar')) {
    this.slug.ar = slugify(this.title.ar, { lower: true, strict: true });
  }
  next();
});


module.exports = mongoose.model("Package", packageSchema);