const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist and are writable
const uploadDirs = ['uploads/profiles', 'uploads/notices', 'uploads/reports', 'uploads/messages', 'uploads/general'];
uploadDirs.forEach(dir => {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created upload directory: ${dir}`);
    }
    // Test write permissions
    const testFile = path.join(dir, '.write-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
  } catch (error) {
    console.error(`Failed to create or write to upload directory ${dir}:`, error);
    throw new Error(`Upload directory ${dir} is not accessible`);
  }
});

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = 'uploads/';
    
    // Determine upload path based on route or field name
    if (req.route.path.includes('/profile')) {
      uploadPath += 'profiles/';
    } else if (req.route.path.includes('/notices')) {
      uploadPath += 'notices/';
    } else if (req.route.path.includes('/reports')) {
      uploadPath += 'reports/';
    } else if (req.route.path.includes('/messages')) {
      uploadPath += 'messages/';
    } else {
      uploadPath += 'general/';
    }
    
    // Ensure directory exists
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, extension);
    cb(null, `${baseName}-${uniqueSuffix}${extension}`);
  }
});

// File filter function
const fileFilter = (req, file, cb) => {
  // Define allowed file types
  const allowedImageTypes = /jpeg|jpg|png|gif|webp/;
  const allowedVideoTypes = /mp4|avi|mov|wmv|flv|webm/;
  const allowedDocTypes = /pdf|doc|docx|txt/;
  
  const extname = allowedImageTypes.test(path.extname(file.originalname).toLowerCase()) ||
                  allowedVideoTypes.test(path.extname(file.originalname).toLowerCase()) ||
                  allowedDocTypes.test(path.extname(file.originalname).toLowerCase());
  
  const mimetype = file.mimetype.startsWith('image/') ||
                   file.mimetype.startsWith('video/') ||
                   file.mimetype === 'application/pdf' ||
                   file.mimetype.includes('document') ||
                   file.mimetype === 'text/plain';

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images, videos, and documents are allowed.'));
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files per request
  },
  fileFilter: fileFilter
});

// Middleware configurations for different use cases
const uploadConfigs = {
  // Single profile image
  profileImage: upload.single('profileImage'),
  
  // Multiple media files for notices/reports
  media: upload.array('media', 5),
  
  // Single file for messages
  messageFile: upload.single('file'),
  
  // Any file type for general uploads
  any: upload.any()
};

// Error handling middleware
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 10MB.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum is 5 files per upload.'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected field name for file upload.'
      });
    }
  }
  
  if (error.message.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  
  // Other errors
  return res.status(500).json({
    success: false,
    message: 'File upload failed.'
  });
};

// Utility function to clean up uploaded files on error
const cleanupFiles = (files) => {
  if (!files) return;
  
  const fileArray = Array.isArray(files) ? files : [files];
  fileArray.forEach(file => {
    if (file && file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  });
};

// Utility function to get file type from mimetype
const getFileType = (mimetype) => {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  return 'file';
};

// Utility function to format file info
const formatFileInfo = (file) => {
  // Normalize the path to use forward slashes and ensure it starts with /uploads/
  const relativePath = path.relative('uploads', file.path).replace(/\\/g, '/');
  
  console.log('Formatting file info:', {
    originalPath: file.path,
    relativePath,
    filename: file.originalname,
    size: file.size,
    mimetype: file.mimetype
  });
  
  // Ensure the URL is properly formatted
  const url = `/uploads/${relativePath}`.replace(/\/+/g, '/'); // Remove duplicate slashes
  
  return {
    type: getFileType(file.mimetype),
    url: url,
    filename: file.originalname,
    size: file.size,
    mimetype: file.mimetype
  };
};

module.exports = {
  uploadConfigs,
  handleUploadError,
  cleanupFiles,
  getFileType,
  formatFileInfo
};