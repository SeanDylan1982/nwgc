/**
 * LegalDocumentService.js
 * Service for managing legal documents with versioning and POPIA compliance
 * Implements comprehensive error handling following the app's patterns
 */
const LegalDocument = require('../models/LegalDocument');
const User = require('../models/User');

class LegalDocumentService {
  /**
   * Get the active document of a specific type
   * @param {string} type - Document type
   * @returns {Promise<Object>} - Active document
   */
  async getActiveDocument(type) {
    try {
      if (!type) {
        throw new Error('Document type is required');
      }

      const validTypes = ['termsOfService', 'privacyPolicy', 'noticeBoardTerms', 'reportTerms'];
      if (!validTypes.includes(type)) {
        throw new Error(`Invalid document type. Must be one of: ${validTypes.join(', ')}`);
      }

      const document = await LegalDocument.getActiveDocument(type);
      
      if (!document) {
        // Return default document if none exists
        return this.getDefaultDocument(type);
      }

      return document.getFormattedContent();
    } catch (error) {
      console.error(`Error getting active document for type ${type}:`, error);
      throw error;
    }
  }

  /**
   * Get document by ID and version
   * @param {string} type - Document type
   * @param {string} version - Document version
   * @returns {Promise<Object>} - Document
   */
  async getDocument(type, version) {
    try {
      if (!type || !version) {
        throw new Error('Document type and version are required');
      }

      const document = await LegalDocument.findOne({ type, version })
        .populate('createdBy approvedBy', 'firstName lastName email');

      if (!document) {
        throw new Error(`Document not found: ${type} v${version}`);
      }

      return document.getFormattedContent();
    } catch (error) {
      console.error(`Error getting document ${type} v${version}:`, error);
      throw error;
    }
  }

  /**
   * Create a new legal document
   * @param {Object} documentData - Document data
   * @param {string} createdBy - User ID of creator
   * @returns {Promise<Object>} - Created document
   */
  async createDocument(documentData, createdBy) {
    try {
      const {
        type,
        title,
        content,
        summary,
        version,
        effectiveDate,
        sections = [],
        metadata = {}
      } = documentData;

      if (!type || !title || !content || !createdBy) {
        throw new Error('Type, title, content, and creator are required');
      }

      // Validate document type
      const validTypes = ['termsOfService', 'privacyPolicy', 'noticeBoardTerms', 'reportTerms'];
      if (!validTypes.includes(type)) {
        throw new Error(`Invalid document type. Must be one of: ${validTypes.join(', ')}`);
      }

      // Check if creator exists
      const creator = await User.findById(createdBy);
      if (!creator) {
        throw new Error('Creator not found');
      }

      // Check if creator has permission (admin or moderator)
      if (!['admin', 'moderator'].includes(creator.role)) {
        throw new Error('Insufficient permissions to create legal documents');
      }

      // Set default metadata
      const defaultMetadata = {
        language: 'en',
        jurisdiction: 'ZA',
        complianceStandards: type === 'privacyPolicy' ? ['POPIA'] : [],
        lastReviewDate: new Date(),
        changeReason: 'Initial creation',
        ...metadata
      };

      const document = new LegalDocument({
        type,
        title,
        content,
        summary,
        version,
        effectiveDate: effectiveDate || new Date(),
        createdBy,
        sections: sections.map((section, index) => ({
          ...section,
          order: section.order || index + 1
        })),
        metadata: defaultMetadata
      });

      await document.save();

      console.log(`Legal document created: ${type} v${document.version} by user ${createdBy}`);

      return document.getFormattedContent();
    } catch (error) {
      console.error('Error creating legal document:', error);
      throw error;
    }
  }

  /**
   * Update an existing legal document (creates new version)
   * @param {string} documentId - Document ID to update
   * @param {Object} updateData - Update data
   * @param {string} updatedBy - User ID of updater
   * @returns {Promise<Object>} - New document version
   */
  async updateDocument(documentId, updateData, updatedBy) {
    try {
      if (!documentId || !updatedBy) {
        throw new Error('Document ID and updater are required');
      }

      // Get existing document
      const existingDoc = await LegalDocument.findById(documentId);
      if (!existingDoc) {
        throw new Error('Document not found');
      }

      // Check if updater exists and has permission
      const updater = await User.findById(updatedBy);
      if (!updater) {
        throw new Error('Updater not found');
      }

      if (!['admin', 'moderator'].includes(updater.role)) {
        throw new Error('Insufficient permissions to update legal documents');
      }

      // Create new version
      const newVersion = parseFloat(existingDoc.version) + 0.1;
      
      const newDocument = new LegalDocument({
        type: existingDoc.type,
        title: updateData.title || existingDoc.title,
        content: updateData.content || existingDoc.content,
        summary: updateData.summary || existingDoc.summary,
        version: newVersion.toFixed(1),
        effectiveDate: updateData.effectiveDate || new Date(),
        createdBy: updatedBy,
        sections: updateData.sections || existingDoc.sections,
        metadata: {
          ...existingDoc.metadata,
          ...updateData.metadata,
          lastReviewDate: new Date(),
          changeReason: updateData.changeReason || 'Document update'
        }
      });

      await newDocument.save();

      console.log(`Legal document updated: ${existingDoc.type} v${newDocument.version} by user ${updatedBy}`);

      return newDocument.getFormattedContent();
    } catch (error) {
      console.error('Error updating legal document:', error);
      throw error;
    }
  }

  /**
   * Activate a document version
   * @param {string} documentId - Document ID to activate
   * @param {string} activatedBy - User ID of activator
   * @returns {Promise<Object>} - Activated document
   */
  async activateDocument(documentId, activatedBy) {
    try {
      if (!documentId || !activatedBy) {
        throw new Error('Document ID and activator are required');
      }

      const document = await LegalDocument.findById(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      // Check if activator has permission
      const activator = await User.findById(activatedBy);
      if (!activator || !['admin', 'moderator'].includes(activator.role)) {
        throw new Error('Insufficient permissions to activate legal documents');
      }

      await document.activate();
      await document.approve(activatedBy);

      console.log(`Legal document activated: ${document.type} v${document.version} by user ${activatedBy}`);

      return document.getFormattedContent();
    } catch (error) {
      console.error('Error activating legal document:', error);
      throw error;
    }
  }

  /**
   * Get document history for a type
   * @param {string} type - Document type
   * @param {number} limit - Number of documents to return
   * @returns {Promise<Array>} - Document history
   */
  async getDocumentHistory(type, limit = 10) {
    try {
      if (!type) {
        throw new Error('Document type is required');
      }

      const documents = await LegalDocument.getDocumentHistory(type, limit);
      
      return documents.map(doc => ({
        id: doc._id,
        type: doc.type,
        version: doc.version,
        title: doc.title,
        summary: doc.summary,
        active: doc.active,
        effectiveDate: doc.effectiveDate,
        createdAt: doc.createdAt,
        createdBy: doc.createdBy,
        approvedBy: doc.approvedBy,
        approvedAt: doc.approvedAt,
        acceptanceStats: doc.acceptanceStats,
        displayVersion: doc.displayVersion,
        age: doc.age
      }));
    } catch (error) {
      console.error(`Error getting document history for type ${type}:`, error);
      throw error;
    }
  }

  /**
   * Record user acceptance of a document
   * @param {string} userId - User ID
   * @param {string} documentType - Document type
   * @param {string} version - Document version
   * @returns {Promise<Object>} - Acceptance record
   */
  async recordAcceptance(userId, documentType, version) {
    try {
      if (!userId || !documentType) {
        throw new Error('User ID and document type are required');
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Get current active document if version not specified
      let documentVersion = version;
      if (!documentVersion) {
        const activeDoc = await LegalDocument.getActiveDocument(documentType);
        if (activeDoc) {
          documentVersion = activeDoc.version;
        } else {
          documentVersion = '1.0'; // Default version
        }
      }

      // Update user's legal acceptance
      const updateData = {
        [`legalAcceptance.${documentType}.accepted`]: true,
        [`legalAcceptance.${documentType}.version`]: documentVersion,
        [`legalAcceptance.${documentType}.timestamp`]: new Date()
      };

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true, runValidators: true }
      ).select(`legalAcceptance.${documentType}`);

      if (!updatedUser) {
        throw new Error('Failed to record acceptance');
      }

      // Update document acceptance statistics
      const document = await LegalDocument.findOne({ 
        type: documentType, 
        version: documentVersion 
      });
      
      if (document) {
        await document.updateAcceptanceStats();
      }

      console.log(`User ${userId} accepted ${documentType} v${documentVersion}`);

      return {
        success: true,
        documentType,
        version: documentVersion,
        timestamp: updatedUser.legalAcceptance[documentType].timestamp
      };
    } catch (error) {
      console.error(`Error recording acceptance for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Check if user has accepted a document
   * @param {string} userId - User ID
   * @param {string} documentType - Document type
   * @returns {Promise<Object>} - Acceptance status
   */
  async checkAcceptance(userId, documentType) {
    try {
      if (!userId || !documentType) {
        throw new Error('User ID and document type are required');
      }

      const user = await User.findById(userId).select(`legalAcceptance.${documentType}`);
      if (!user) {
        throw new Error('User not found');
      }

      const acceptance = user.legalAcceptance?.[documentType];
      const hasAccepted = acceptance?.accepted === true;

      // Get latest version to check if user needs to re-accept
      const activeDoc = await LegalDocument.getActiveDocument(documentType);
      const latestVersion = activeDoc?.version || '1.0';
      const userVersion = acceptance?.version;
      
      const needsReAcceptance = hasAccepted && userVersion && userVersion !== latestVersion;

      return {
        accepted: hasAccepted && !needsReAcceptance,
        version: userVersion,
        timestamp: acceptance?.timestamp,
        latestVersion,
        needsReAcceptance
      };
    } catch (error) {
      console.error(`Error checking acceptance for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get latest version of a document type
   * @param {string} documentType - Document type
   * @returns {Promise<string>} - Latest version
   */
  async getLatestVersion(documentType) {
    try {
      if (!documentType) {
        throw new Error('Document type is required');
      }

      const activeDoc = await LegalDocument.getActiveDocument(documentType);
      return activeDoc?.version || '1.0';
    } catch (error) {
      console.error(`Error getting latest version for ${documentType}:`, error);
      throw error;
    }
  }

  /**
   * Search legal documents
   * @param {string} query - Search query
   * @param {Object} filters - Search filters
   * @returns {Promise<Array>} - Search results
   */
  async searchDocuments(query, filters = {}) {
    try {
      const searchQuery = {};

      // Text search
      if (query) {
        searchQuery.$text = { $search: query };
      }

      // Type filter
      if (filters.type) {
        searchQuery.type = filters.type;
      }

      // Active filter
      if (filters.active !== undefined) {
        searchQuery.active = filters.active;
      }

      // Date range filter
      if (filters.dateFrom || filters.dateTo) {
        searchQuery.createdAt = {};
        if (filters.dateFrom) {
          searchQuery.createdAt.$gte = new Date(filters.dateFrom);
        }
        if (filters.dateTo) {
          searchQuery.createdAt.$lte = new Date(filters.dateTo);
        }
      }

      const documents = await LegalDocument.find(searchQuery)
        .populate('createdBy approvedBy', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .limit(filters.limit || 50);

      return documents.map(doc => ({
        id: doc._id,
        type: doc.type,
        version: doc.version,
        title: doc.title,
        summary: doc.summary,
        active: doc.active,
        effectiveDate: doc.effectiveDate,
        createdAt: doc.createdAt,
        createdBy: doc.createdBy,
        approvedBy: doc.approvedBy,
        displayVersion: doc.displayVersion,
        age: doc.age
      }));
    } catch (error) {
      console.error('Error searching legal documents:', error);
      throw error;
    }
  }

  /**
   * Get default document content for a type
   * @param {string} type - Document type
   * @returns {Object} - Default document
   */
  getDefaultDocument(type) {
    const defaultDocuments = {
      termsOfService: {
        type: 'termsOfService',
        version: '1.0',
        title: 'Terms of Service',
        content: this.getDefaultTermsOfServiceContent(),
        summary: 'Terms and conditions for using the neighbourhood watch application',
        effectiveDate: new Date(),
        metadata: {
          language: 'en',
          jurisdiction: 'ZA',
          complianceStandards: []
        }
      },
      privacyPolicy: {
        type: 'privacyPolicy',
        version: '1.0',
        title: 'Privacy Policy',
        content: this.getDefaultPrivacyPolicyContent(),
        summary: 'Privacy policy including POPIA compliance information',
        effectiveDate: new Date(),
        metadata: {
          language: 'en',
          jurisdiction: 'ZA',
          complianceStandards: ['POPIA']
        }
      }
    };

    return defaultDocuments[type] || {
      type,
      version: '1.0',
      title: 'Legal Document',
      content: 'Please contact support for the latest legal documents.',
      summary: 'Legal document not available',
      effectiveDate: new Date(),
      metadata: {
        language: 'en',
        jurisdiction: 'ZA',
        complianceStandards: []
      }
    };
  }

  /**
   * Get default Terms of Service content
   */
  getDefaultTermsOfServiceContent() {
    return `
      <h1>Terms of Service</h1>
      
      <p><strong>Effective Date:</strong> ${new Date().toLocaleDateString()}</p>
      
      <h2>1. Acceptance of Terms</h2>
      <p>By accessing and using this neighbourhood watch application, you accept and agree to be bound by the terms and provision of this agreement.</p>
      
      <h2>2. Use License</h2>
      <p>Permission is granted to temporarily use this application for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title.</p>
      
      <h2>3. User Responsibilities</h2>
      <p>Users are responsible for:</p>
      <ul>
        <li>Maintaining the confidentiality of their account information</li>
        <li>All activities that occur under their account</li>
        <li>Ensuring all information provided is accurate and up-to-date</li>
        <li>Complying with all applicable laws and regulations</li>
      </ul>
      
      <h2>4. Prohibited Uses</h2>
      <p>You may not use this application:</p>
      <ul>
        <li>For any unlawful purpose or to solicit others to perform unlawful acts</li>
        <li>To violate any international, federal, provincial, or state regulations, rules, laws, or local ordinances</li>
        <li>To infringe upon or violate our intellectual property rights or the intellectual property rights of others</li>
        <li>To harass, abuse, insult, harm, defame, slander, disparage, intimidate, or discriminate</li>
      </ul>
      
      <h2>5. Privacy Policy</h2>
      <p>Your privacy is important to us. Please review our Privacy Policy, which also governs your use of the application, to understand our practices.</p>
      
      <h2>6. Termination</h2>
      <p>We may terminate or suspend your account and bar access to the application immediately, without prior notice or liability, under our sole discretion, for any reason whatsoever.</p>
      
      <h2>7. Governing Law</h2>
      <p>These terms shall be governed and construed in accordance with the laws of South Africa, without regard to its conflict of law provisions.</p>
      
      <h2>8. Contact Information</h2>
      <p>If you have any questions about these Terms of Service, please contact us through the application support system.</p>
    `;
  }

  /**
   * Get default Privacy Policy content with POPIA compliance
   */
  getDefaultPrivacyPolicyContent() {
    return `
      <h1>Privacy Policy</h1>
      
      <p><strong>Effective Date:</strong> ${new Date().toLocaleDateString()}</p>
      
      <h2>1. Introduction</h2>
      <p>This Privacy Policy describes how we collect, use, and protect your personal information in accordance with the Protection of Personal Information Act (POPIA) of South Africa.</p>
      
      <h2>2. Information We Collect</h2>
      <p>We collect the following types of information:</p>
      <ul>
        <li><strong>Personal Information:</strong> Name, email address, phone number, and address</li>
        <li><strong>Usage Information:</strong> How you use the application, including posts, messages, and interactions</li>
        <li><strong>Technical Information:</strong> Device information, IP address, and browser type</li>
        <li><strong>Location Information:</strong> Neighbourhood location for community features</li>
      </ul>
      
      <h2>3. How We Use Your Information</h2>
      <p>We use your information to:</p>
      <ul>
        <li>Provide and maintain the neighbourhood watch service</li>
        <li>Facilitate communication between community members</li>
        <li>Send notifications about community activities and safety alerts</li>
        <li>Improve our services and user experience</li>
        <li>Comply with legal obligations</li>
      </ul>
      
      <h2>4. POPIA Compliance</h2>
      <p>In accordance with the Protection of Personal Information Act (POPIA), we ensure:</p>
      <ul>
        <li><strong>Lawful Processing:</strong> We process your information lawfully and fairly</li>
        <li><strong>Purpose Limitation:</strong> Information is collected for specific, explicit, and legitimate purposes</li>
        <li><strong>Data Minimization:</strong> We only collect information that is necessary for our services</li>
        <li><strong>Accuracy:</strong> We take steps to ensure your information is accurate and up-to-date</li>
        <li><strong>Storage Limitation:</strong> Information is kept only as long as necessary</li>
        <li><strong>Security:</strong> We implement appropriate security measures to protect your information</li>
      </ul>
      
      <h2>5. Your Rights Under POPIA</h2>
      <p>You have the right to:</p>
      <ul>
        <li>Access your personal information</li>
        <li>Correct or update your information</li>
        <li>Delete your information (subject to legal requirements)</li>
        <li>Object to processing of your information</li>
        <li>Withdraw consent where processing is based on consent</li>
        <li>Lodge a complaint with the Information Regulator</li>
      </ul>
      
      <h2>6. Information Sharing</h2>
      <p>We do not sell, trade, or rent your personal information to third parties. We may share information:</p>
      <ul>
        <li>With your consent</li>
        <li>To comply with legal obligations</li>
        <li>To protect our rights and safety</li>
        <li>In case of business transfer or merger</li>
      </ul>
      
      <h2>7. Data Security</h2>
      <p>We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.</p>
      
      <h2>8. Data Retention</h2>
      <p>We retain your personal information only for as long as necessary to fulfill the purposes for which it was collected, comply with legal obligations, and resolve disputes.</p>
      
      <h2>9. International Transfers</h2>
      <p>Your information is processed and stored within South Africa. If we need to transfer information internationally, we will ensure appropriate safeguards are in place.</p>
      
      <h2>10. Children's Privacy</h2>
      <p>Our service is not intended for children under 18. We do not knowingly collect personal information from children under 18.</p>
      
      <h2>11. Changes to This Policy</h2>
      <p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the effective date.</p>
      
      <h2>12. Contact Information</h2>
      <p>If you have questions about this Privacy Policy or wish to exercise your rights under POPIA, please contact us:</p>
      <ul>
        <li>Through the application support system</li>
        <li>Information Regulator South Africa: <a href="https://inforegulator.org.za">https://inforegulator.org.za</a></li>
      </ul>
      
      <h2>13. Information Regulator Details</h2>
      <p>If you are not satisfied with our response to your privacy concerns, you may lodge a complaint with:</p>
      <p><strong>Information Regulator South Africa</strong><br>
      Email: inforeg@justice.gov.za<br>
      Website: https://inforegulator.org.za</p>
    `;
  }
}

module.exports = new LegalDocumentService();