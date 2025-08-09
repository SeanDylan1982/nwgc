const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class PortManager {
  constructor() {
    this.requiredPorts = [3000, 5001]; // Frontend and Backend
    this.processesToKill = ['node', 'npm', 'react-scripts'];
  }

  async killProcessesOnPorts() {
    console.log('🔥 Killing processes on required ports...');
    
    for (const port of this.requiredPorts) {
      try {
        // Windows command to find and kill processes on specific ports
        const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
        
        if (stdout.trim()) {
          console.log(`📍 Found processes on port ${port}:`);
          console.log(stdout);
          
          // Extract PIDs and kill them
          const lines = stdout.split('\n').filter(line => line.trim());
          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            
            if (pid && !isNaN(pid)) {
              try {
                await execAsync(`taskkill /PID ${pid} /F`);
                console.log(`✅ Killed process ${pid} on port ${port}`);
              } catch (error) {
                console.log(`⚠️ Could not kill process ${pid}: ${error.message}`);
              }
            }
          }
        } else {
          console.log(`✅ Port ${port} is free`);
        }
      } catch (error) {
        console.log(`✅ Port ${port} appears to be free`);
      }
    }
  }

  async killNodeProcesses() {
    console.log('🔥 Killing all Node.js and npm processes...');
    
    try {
      // Kill all node processes
      await execAsync('taskkill /IM node.exe /F').catch(() => {});
      await execAsync('taskkill /IM npm.exe /F').catch(() => {});
      console.log('✅ Killed Node.js processes');
    } catch (error) {
      console.log('✅ No Node.js processes to kill');
    }
  }

  async testPorts() {
    console.log('🔍 Testing port availability...');
    
    for (const port of this.requiredPorts) {
      try {
        const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
        if (stdout.trim()) {
          console.log(`❌ Port ${port} is still occupied:`);
          console.log(stdout);
        } else {
          console.log(`✅ Port ${port} is available`);
        }
      } catch (error) {
        console.log(`✅ Port ${port} is available`);
      }
    }
  }

  async testDatabaseConnection() {
    console.log('🔍 Testing database connection...');
    
    try {
      // Import and test MongoDB connection
      const mongoose = require('mongoose');
      const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://admin:admin123@cluster0.mongodb.net/neighbourhood-watch?retryWrites=true&w=majority';
      
      await mongoose.connect(mongoUri);
      console.log('✅ Database connection successful');
      
      // Test collections
      const User = require('../server/models/User');
      const Notice = require('../server/models/Notice');
      const Report = require('../server/models/Report');
      
      const userCount = await User.countDocuments();
      const noticeCount = await Notice.countDocuments();
      const reportCount = await Report.countDocuments();
      
      console.log(`📊 Database contents:`);
      console.log(`   Users: ${userCount}`);
      console.log(`   Notices: ${noticeCount}`);
      console.log(`   Reports: ${reportCount}`);
      
      await mongoose.disconnect();
      
      return { userCount, noticeCount, reportCount };
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      return null;
    }
  }

  async startServers() {
    console.log('🚀 Starting servers...');
    
    // Start backend server
    console.log('Starting backend server on port 5001...');
    const backendProcess = exec('npm start', { cwd: './server' });
    
    backendProcess.stdout.on('data', (data) => {
      console.log(`[BACKEND] ${data}`);
    });
    
    backendProcess.stderr.on('data', (data) => {
      console.error(`[BACKEND ERROR] ${data}`);
    });
    
    // Wait a bit for backend to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test backend health
    try {
      const response = await fetch('http://localhost:5001/api/health');
      if (response.ok) {
        console.log('✅ Backend server is running and healthy');
      } else {
        console.log('❌ Backend server is not responding properly');
      }
    } catch (error) {
      console.log('❌ Backend server is not accessible:', error.message);
    }
    
    return backendProcess;
  }

  async fullReset() {
    console.log('🔄 Starting full system reset...');
    
    // Step 1: Kill all processes
    await this.killNodeProcesses();
    await this.killProcessesOnPorts();
    
    // Step 2: Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 3: Test ports
    await this.testPorts();
    
    // Step 4: Test database
    const dbStats = await this.testDatabaseConnection();
    
    if (!dbStats) {
      console.log('❌ Cannot proceed without database connection');
      return false;
    }
    
    console.log('✅ System reset complete. Ready to start servers.');
    return true;
  }
}

// Run if called directly
if (require.main === module) {
  const manager = new PortManager();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'reset':
      manager.fullReset();
      break;
    case 'kill':
      manager.killNodeProcesses().then(() => manager.killProcessesOnPorts());
      break;
    case 'test':
      manager.testPorts().then(() => manager.testDatabaseConnection());
      break;
    case 'start':
      manager.startServers();
      break;
    default:
      console.log('Usage: node port-manager.js [reset|kill|test|start]');
  }
}

module.exports = PortManager;