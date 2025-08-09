/**
 * Seed Legal Documents Script
 * Creates default legal documents in the database
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const mongoose = require('mongoose');
const LegalDocument = require('../models/LegalDocument');
const User = require('../models/User');

async function seedLegalDocuments() {
  try {
    console.log('🌱 Starting legal documents seeding...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find or create admin user
    let adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.log('⚠️  No admin user found, creating one...');
      adminUser = new User({
        email: 'admin@neighbourhood.com',
        password: 'admin123',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        isVerified: true,
        isActive: true
      });
      await adminUser.save();
      console.log('✅ Admin user created');
    }

    // Define legal documents to create
    const documentsToCreate = [
      {
        type: 'termsOfService',
        title: 'Terms of Service',
        summary: 'Terms and conditions for using the neighbourhood watch application',
        content: getTermsOfServiceContent(),
        sections: [
          {
            title: 'Acceptance of Terms',
            content: '<p>By accessing and using this neighbourhood watch application, you accept and agree to be bound by the terms and provision of this agreement.</p>',
            order: 1
          },
          {
            title: 'User Responsibilities',
            content: '<p>Users are responsible for maintaining the confidentiality of their account information and all activities that occur under their account.</p>',
            order: 2
          },
          {
            title: 'Prohibited Uses',
            content: '<p>You may not use this application for any unlawful purpose or to violate any applicable laws and regulations.</p>',
            order: 3
          }
        ],
        metadata: {
          language: 'en',
          jurisdiction: 'ZA',
          complianceStandards: [],
          changeReason: 'Initial creation'
        }
      },
      {
        type: 'privacyPolicy',
        title: 'Privacy Policy',
        summary: 'Privacy policy including POPIA compliance information for South African users',
        content: getPrivacyPolicyContent(),
        sections: [
          {
            title: 'Information We Collect',
            content: '<p>We collect personal information, usage information, technical information, and location information as described in this policy.</p>',
            order: 1
          },
          {
            title: 'POPIA Compliance',
            content: '<p>We comply with South Africa\'s Protection of Personal Information Act (POPIA) in all our data processing activities.</p>',
            order: 2
          },
          {
            title: 'Your Rights',
            content: '<p>Under POPIA, you have the right to access, correct, delete, and object to processing of your personal information.</p>',
            order: 3
          }
        ],
        metadata: {
          language: 'en',
          jurisdiction: 'ZA',
          complianceStandards: ['POPIA'],
          changeReason: 'Initial creation with POPIA compliance'
        }
      }
    ];

    // Create documents
    for (const docData of documentsToCreate) {
      try {
        // Check if document already exists
        const existingDoc = await LegalDocument.findOne({ 
          type: docData.type, 
          active: true 
        });

        if (existingDoc) {
          console.log(`⏭️  ${docData.type} already exists (v${existingDoc.version}), skipping...`);
          continue;
        }

        // Create new document
        const document = new LegalDocument({
          ...docData,
          createdBy: adminUser._id,
          active: true,
          effectiveDate: new Date(),
          approvedBy: adminUser._id,
          approvedAt: new Date()
        });

        await document.save();
        console.log(`✅ Created ${docData.type} v${document.version}`);
      } catch (error) {
        console.error(`❌ Error creating ${docData.type}:`, error.message);
      }
    }

    console.log('🎉 Legal documents seeding completed!');
    
    // Display summary
    const allDocs = await LegalDocument.find({}).populate('createdBy', 'firstName lastName email');
    console.log('\n📊 Legal Documents Summary:');
    console.log('═'.repeat(50));
    
    for (const doc of allDocs) {
      console.log(`📄 ${doc.type} v${doc.version}`);
      console.log(`   Title: ${doc.title}`);
      console.log(`   Active: ${doc.active ? '✅' : '❌'}`);
      console.log(`   Created: ${doc.createdAt.toLocaleDateString()}`);
      if (doc.createdBy) {
        console.log(`   Creator: ${doc.createdBy.firstName} ${doc.createdBy.lastName}`);
      } else {
        console.log(`   Creator: Unknown`);
      }
      console.log(`   Compliance: ${doc.metadata?.complianceStandards?.join(', ') || 'None'}`);
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error seeding legal documents:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

function getTermsOfServiceContent() {
  return `
    <h1>Terms of Service</h1>
    
    <p><strong>Effective Date:</strong> ${new Date().toLocaleDateString()}</p>
    
    <h2>1. Acceptance of Terms</h2>
    <p>By accessing and using this neighbourhood watch application ("Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.</p>
    
    <h2>2. Use License</h2>
    <p>Permission is granted to temporarily use this application for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:</p>
    <ul>
      <li>modify or copy the materials</li>
      <li>use the materials for any commercial purpose or for any public display (commercial or non-commercial)</li>
      <li>attempt to decompile or reverse engineer any software contained in the application</li>
      <li>remove any copyright or other proprietary notations from the materials</li>
    </ul>
    
    <h2>3. User Account and Responsibilities</h2>
    <p>Users are responsible for:</p>
    <ul>
      <li>Maintaining the confidentiality of their account information and password</li>
      <li>All activities that occur under their account</li>
      <li>Ensuring all information provided is accurate and up-to-date</li>
      <li>Complying with all applicable laws and regulations</li>
      <li>Respecting the privacy and rights of other community members</li>
    </ul>
    
    <h2>4. Community Guidelines</h2>
    <p>Our neighbourhood watch application is designed to foster a safe and supportive community. Users must:</p>
    <ul>
      <li>Be respectful and courteous to all community members</li>
      <li>Share information that is accurate and helpful</li>
      <li>Respect privacy and confidentiality</li>
      <li>Report genuine safety concerns and incidents</li>
      <li>Use the platform for its intended community safety purposes</li>
    </ul>
    
    <h2>5. Prohibited Uses</h2>
    <p>You may not use this application:</p>
    <ul>
      <li>For any unlawful purpose or to solicit others to perform unlawful acts</li>
      <li>To violate any international, federal, provincial, or state regulations, rules, laws, or local ordinances</li>
      <li>To infringe upon or violate our intellectual property rights or the intellectual property rights of others</li>
      <li>To harass, abuse, insult, harm, defame, slander, disparage, intimidate, or discriminate based on gender, sexual orientation, religion, ethnicity, race, age, national origin, or disability</li>
      <li>To submit false or misleading information</li>
      <li>To upload viruses or any other malicious code</li>
      <li>To collect or track the personal information of others</li>
      <li>To spam, phish, pharm, pretext, spider, crawl, or scrape</li>
    </ul>
    
    <h2>6. Content and Intellectual Property</h2>
    <p>Users retain ownership of content they post but grant us a license to use, display, and distribute such content within the application. We reserve the right to remove content that violates these terms or is otherwise objectionable.</p>
    
    <h2>7. Privacy Policy</h2>
    <p>Your privacy is important to us. Please review our Privacy Policy, which also governs your use of the application, to understand our practices regarding the collection and use of your personal information.</p>
    
    <h2>8. Disclaimers and Limitation of Liability</h2>
    <p>The information on this application is provided on an 'as is' basis. To the fullest extent permitted by law, we exclude all representations, warranties, and conditions relating to our application and the use of this application.</p>
    
    <h2>9. Termination</h2>
    <p>We may terminate or suspend your account and bar access to the application immediately, without prior notice or liability, under our sole discretion, for any reason whatsoever and without limitation, including but not limited to a breach of the Terms.</p>
    
    <h2>10. Governing Law</h2>
    <p>These terms shall be governed and construed in accordance with the laws of South Africa, without regard to its conflict of law provisions. Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights.</p>
    
    <h2>11. Changes to Terms</h2>
    <p>We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will try to provide at least 30 days notice prior to any new terms taking effect.</p>
    
    <h2>12. Contact Information</h2>
    <p>If you have any questions about these Terms of Service, please contact us through the application support system or at the contact information provided in the application.</p>
    
    <p><em>Last updated: ${new Date().toLocaleDateString()}</em></p>
  `;
}

function getPrivacyPolicyContent() {
  return `
    <h1>Privacy Policy</h1>
    
    <p><strong>Effective Date:</strong> ${new Date().toLocaleDateString()}</p>
    
    <h2>1. Introduction</h2>
    <p>This Privacy Policy describes how we collect, use, and protect your personal information when you use our neighbourhood watch application. We are committed to protecting your privacy and complying with the Protection of Personal Information Act (POPIA) of South Africa.</p>
    
    <h2>2. Information We Collect</h2>
    <p>We collect the following types of information:</p>
    
    <h3>2.1 Personal Information</h3>
    <ul>
      <li><strong>Contact Information:</strong> Name, email address, phone number</li>
      <li><strong>Address Information:</strong> Residential address for neighbourhood verification</li>
      <li><strong>Profile Information:</strong> Profile picture, bio, preferences</li>
      <li><strong>Authentication Information:</strong> Username, password (encrypted)</li>
    </ul>
    
    <h3>2.2 Usage Information</h3>
    <ul>
      <li>Posts, messages, and comments you create</li>
      <li>Reports and notices you submit</li>
      <li>Interactions with other users (likes, comments, friend requests)</li>
      <li>Application usage patterns and preferences</li>
    </ul>
    
    <h3>2.3 Technical Information</h3>
    <ul>
      <li>Device information (type, operating system, browser)</li>
      <li>IP address and general location information</li>
      <li>Log files and usage analytics</li>
      <li>Cookies and similar tracking technologies</li>
    </ul>
    
    <h2>3. How We Use Your Information</h2>
    <p>We use your information to:</p>
    <ul>
      <li>Provide and maintain the neighbourhood watch service</li>
      <li>Facilitate communication between community members</li>
      <li>Send notifications about community activities and safety alerts</li>
      <li>Verify your neighbourhood membership</li>
      <li>Improve our services and user experience</li>
      <li>Ensure platform security and prevent abuse</li>
      <li>Comply with legal obligations</li>
      <li>Provide customer support</li>
    </ul>
    
    <h2>4. POPIA Compliance</h2>
    <p>In accordance with the Protection of Personal Information Act (POPIA) of South Africa, we ensure:</p>
    
    <h3>4.1 Lawful Processing</h3>
    <p>We process your information lawfully, fairly, and transparently based on:</p>
    <ul>
      <li>Your consent for specific processing activities</li>
      <li>Legitimate interests in providing community safety services</li>
      <li>Contractual necessity for service provision</li>
      <li>Legal obligations we must comply with</li>
    </ul>
    
    <h3>4.2 Purpose Limitation</h3>
    <p>Information is collected for specific, explicit, and legitimate purposes related to neighbourhood safety and community building.</p>
    
    <h3>4.3 Data Minimization</h3>
    <p>We only collect information that is necessary for our services and do not process excessive amounts of personal information.</p>
    
    <h3>4.4 Accuracy</h3>
    <p>We take reasonable steps to ensure your information is accurate and up-to-date, and provide mechanisms for you to update your information.</p>
    
    <h3>4.5 Storage Limitation</h3>
    <p>Information is kept only as long as necessary for the purposes for which it was collected or as required by law.</p>
    
    <h3>4.6 Security</h3>
    <p>We implement appropriate technical and organizational measures to protect your information against unauthorized access, alteration, disclosure, or destruction.</p>
    
    <h2>5. Your Rights Under POPIA</h2>
    <p>You have the following rights regarding your personal information:</p>
    <ul>
      <li><strong>Right of Access:</strong> Request access to your personal information</li>
      <li><strong>Right to Correction:</strong> Request correction of inaccurate information</li>
      <li><strong>Right to Deletion:</strong> Request deletion of your information (subject to legal requirements)</li>
      <li><strong>Right to Object:</strong> Object to processing of your information</li>
      <li><strong>Right to Restrict Processing:</strong> Request restriction of processing</li>
      <li><strong>Right to Data Portability:</strong> Request transfer of your information</li>
      <li><strong>Right to Withdraw Consent:</strong> Withdraw consent where processing is based on consent</li>
      <li><strong>Right to Lodge a Complaint:</strong> Lodge a complaint with the Information Regulator</li>
    </ul>
    
    <h2>6. Information Sharing and Disclosure</h2>
    <p>We do not sell, trade, or rent your personal information to third parties. We may share information:</p>
    <ul>
      <li>With your explicit consent</li>
      <li>With other community members as part of the neighbourhood watch functionality</li>
      <li>To comply with legal obligations or court orders</li>
      <li>To protect our rights, property, or safety, or that of our users</li>
      <li>In case of business transfer, merger, or acquisition</li>
      <li>With service providers who assist in operating our platform (under strict confidentiality agreements)</li>
    </ul>
    
    <h2>7. Data Security</h2>
    <p>We implement comprehensive security measures including:</p>
    <ul>
      <li>Encryption of data in transit and at rest</li>
      <li>Regular security assessments and updates</li>
      <li>Access controls and authentication mechanisms</li>
      <li>Employee training on data protection</li>
      <li>Incident response procedures</li>
    </ul>
    
    <h2>8. Data Retention</h2>
    <p>We retain your personal information only for as long as necessary to:</p>
    <ul>
      <li>Fulfill the purposes for which it was collected</li>
      <li>Comply with legal, regulatory, or contractual obligations</li>
      <li>Resolve disputes and enforce agreements</li>
    </ul>
    <p>When information is no longer needed, it is securely deleted or anonymized.</p>
    
    <h2>9. International Transfers</h2>
    <p>Your information is primarily processed and stored within South Africa. If we need to transfer information internationally, we will ensure appropriate safeguards are in place as required by POPIA.</p>
    
    <h2>10. Children's Privacy</h2>
    <p>Our service is not intended for children under 18 years of age. We do not knowingly collect personal information from children under 18. If we become aware that we have collected such information, we will take steps to delete it promptly.</p>
    
    <h2>11. Cookies and Tracking Technologies</h2>
    <p>We use cookies and similar technologies to:</p>
    <ul>
      <li>Remember your preferences and settings</li>
      <li>Analyze usage patterns and improve our service</li>
      <li>Provide security features</li>
      <li>Enable certain functionality</li>
    </ul>
    <p>You can control cookie settings through your browser preferences.</p>
    
    <h2>12. Changes to This Policy</h2>
    <p>We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements. We will notify you of any material changes by:</p>
    <ul>
      <li>Posting the updated policy on our platform</li>
      <li>Sending you a notification through the application</li>
      <li>Requiring re-acceptance for significant changes</li>
    </ul>
    
    <h2>13. Contact Information</h2>
    <p>If you have questions about this Privacy Policy or wish to exercise your rights under POPIA, please contact us:</p>
    <ul>
      <li>Through the application support system</li>
      <li>Email: privacy@neighbourhood-watch.com</li>
    </ul>
    
    <h2>14. Information Regulator Contact</h2>
    <p>If you are not satisfied with our response to your privacy concerns, you may lodge a complaint with the Information Regulator of South Africa:</p>
    <p><strong>Information Regulator South Africa</strong><br>
    Email: inforeg@justice.gov.za<br>
    Website: <a href="https://inforegulator.org.za" target="_blank">https://inforegulator.org.za</a><br>
    Phone: +27 12 406 4818</p>
    
    <p><em>Last updated: ${new Date().toLocaleDateString()}</em></p>
  `;
}

// Run the seeding script
if (require.main === module) {
  seedLegalDocuments().catch(console.error);
}

module.exports = { seedLegalDocuments };