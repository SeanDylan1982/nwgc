/**
 * Script to generate self-signed SSL certificates for MongoDB connections
 * This is useful for development environments. For production,
 * use properly signed certificates from a trusted CA.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const certsDir = path.join(__dirname, '..', 'config', 'certs');
const caKeyPath = path.join(certsDir, 'ca.key');
const caCertPath = path.join(certsDir, 'ca.crt');
const serverKeyPath = path.join(certsDir, 'server.key');
const serverCsrPath = path.join(certsDir, 'server.csr');
const serverCertPath = path.join(certsDir, 'server.crt');
const clientKeyPath = path.join(certsDir, 'client.key');
const clientCsrPath = path.join(certsDir, 'client.csr');
const clientCertPath = path.join(certsDir, 'client.crt');

// Create certificates directory if it doesn't exist
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir, { recursive: true });
  console.log(`Created directory: ${certsDir}`);
}

try {
  // Generate CA key and certificate
  console.log('Generating CA key and certificate...');
  execSync(`openssl genrsa -out "${caKeyPath}" 2048`);
  execSync(`openssl req -x509 -new -nodes -key "${caKeyPath}" -sha256 -days 1024 -out "${caCertPath}" -subj "/CN=NeighbourhoodWatchCA"`);
  
  // Generate server key and certificate
  console.log('Generating server key and certificate...');
  execSync(`openssl genrsa -out "${serverKeyPath}" 2048`);
  execSync(`openssl req -new -key "${serverKeyPath}" -out "${serverCsrPath}" -subj "/CN=localhost"`);
  execSync(`openssl x509 -req -in "${serverCsrPath}" -CA "${caCertPath}" -CAkey "${caKeyPath}" -CAcreateserial -out "${serverCertPath}" -days 500 -sha256`);
  
  // Generate client key and certificate
  console.log('Generating client key and certificate...');
  execSync(`openssl genrsa -out "${clientKeyPath}" 2048`);
  execSync(`openssl req -new -key "${clientKeyPath}" -out "${clientCsrPath}" -subj "/CN=neighbourhoodWatchClient"`);
  execSync(`openssl x509 -req -in "${clientCsrPath}" -CA "${caCertPath}" -CAkey "${caKeyPath}" -CAcreateserial -out "${clientCertPath}" -days 500 -sha256`);
  
  console.log('SSL certificates generated successfully!');
  console.log('\nTo use these certificates with MongoDB:');
  console.log(`1. Add the following to your .env file:`);
  console.log(`   DB_USE_SSL=true`);
  console.log(`   DB_SSL_CA_PATH=${caCertPath}`);
  console.log(`   DB_SSL_CERT_PATH=${clientCertPath}`);
  console.log(`   DB_SSL_KEY_PATH=${clientKeyPath}`);
  console.log('\n2. If using MongoDB locally, start it with SSL:');
  console.log(`   mongod --sslMode requireSSL --sslPEMKeyFile "${serverCertPath}" --sslCAFile "${caCertPath}"`);
  
} catch (error) {
  console.error('Error generating SSL certificates:', error.message);
  console.error('Make sure OpenSSL is installed on your system.');
  process.exit(1);
}