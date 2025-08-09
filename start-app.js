const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class AppStarter {
  constructor() {
    this.processes = [];
    this.isShuttingDown = false;
  }

  async killExistingProcesses() {
    console.log('🔥 Killing existing processes...');
    
    try {
      // Kill all node processes
      await this.execAsync('taskkill /IM node.exe /F').catch(() => {});
      await this.execAsync('taskkill /IM npm.exe /F').catch(() => {});
      
      // Kill processes on specific ports
      const ports = [3000, 5001];
      for (const port of ports) {
        try {
          const { stdout } = await this.execAsync(`netstat -ano | findstr :${port}`);
          if (stdout.trim()) {
            const lines = stdout.split('\n').filter(line => line.trim());
            for (const line of lines) {
              const parts = line.trim().split(/\s+/);
              const pid = parts[parts.length - 1];
              if (pid && !isNaN(pid)) {
                await this.execAsync(`taskkill /PID ${pid} /F`).catch(() => {});
              }
            }
          }
        } catch (error) {
          // Port is free
        }
      }
      
      console.log('✅ Processes killed');
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.log('⚠️ Some processes could not be killed:', error.message);
    }
  }

  async testDatabase() {
    console.log('🔍 Testing database connection...');
    
    try {
      const mongoose = require('mongoose');
      const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://admin:admin123@cluster0.mongodb.net/neighbourhood-watch?retryWrites=true&w=majority';
      
      await mongoose.connect(mongoUri);
      console.log('✅ Database connected');
      
      // Test collections
      const User = require('./server/models/User');
      const Notice = require('./server/models/Notice');
      const Report = require('./server/models/Report');
      
      const userCount = await User.countDocuments();
      const noticeCount = await Notice.countDocuments();
      const reportCount = await Report.countDocuments();
      
      console.log(`📊 Database contents:`);
      console.log(`   Users: ${userCount}`);
      console.log(`   Notices: ${noticeCount}`);
      console.log(`   Reports: ${reportCount}`);
      
      await mongoose.disconnect();
      
      if (userCount === 0 || noticeCount === 0 || reportCount === 0) {
        console.log('⚠️ Database appears to be empty. Running seed script...');
        await this.execAsync('node server/scripts/comprehensiveSeed.js');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      return false;
    }
  }

  async startBackend() {
    console.log('🚀 Starting backend server...');
    
    const backendProcess = spawn('npm', ['start'], {
      cwd: './server',
      stdio: 'pipe',
      shell: true
    });
    
    this.processes.push(backendProcess);
    
    backendProcess.stdout.on('data', (data) => {
      console.log(`[BACKEND] ${data.toString().trim()}`);
    });
    
    backendProcess.stderr.on('data', (data) => {
      console.error(`[BACKEND ERROR] ${data.toString().trim()}`);
    });
    
    backendProcess.on('close', (code) => {
      console.log(`[BACKEND] Process exited with code ${code}`);
    });
    
    // Wait for backend to start
    console.log('⏳ Waiting for backend to start...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Test backend health
    try {
      const response = await fetch('http://localhost:5001/api/health');
      if (response.ok) {
        console.log('✅ Backend server is healthy');
        return true;
      } else {
        console.log('❌ Backend server health check failed');
        return false;
      }
    } catch (error) {
      console.log('❌ Backend server is not accessible:', error.message);
      return false;
    }
  }

  async startFrontend() {
    console.log('🚀 Starting frontend server...');
    
    const frontendProcess = spawn('npm', ['start'], {
      cwd: './client',
      stdio: 'pipe',
      shell: true,
      env: { ...process.env, BROWSER: 'none' } // Don't auto-open browser
    });
    
    this.processes.push(frontendProcess);
    
    frontendProcess.stdout.on('data', (data) => {
      const output = data.toString().trim();
      console.log(`[FRONTEND] ${output}`);
      
      // Check if frontend is ready
      if (output.includes('webpack compiled successfully') || output.includes('Compiled successfully')) {
        console.log('✅ Frontend server is ready at http://localhost:3000');
      }
    });
    
    frontendProcess.stderr.on('data', (data) => {
      console.error(`[FRONTEND ERROR] ${data.toString().trim()}`);
    });
    
    frontendProcess.on('close', (code) => {
      console.log(`[FRONTEND] Process exited with code ${code}`);
    });
    
    return true;
  }

  async testFullStack() {
    console.log('🧪 Testing full stack communication...');
    
    // Wait a bit more for frontend to be ready
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    try {
      // Test login
      const loginResponse = await fetch('http://localhost:5001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@neighbourhood.com',
          password: 'admin123'
        })
      });
      
      if (!loginResponse.ok) {
        console.log('❌ Login test failed');
        return false;
      }
      
      const loginData = await loginResponse.json();
      const token = loginData.token;
      
      // Test notices endpoint
      const noticesResponse = await fetch('http://localhost:5001/api/notices', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!noticesResponse.ok) {
        console.log('❌ Notices API test failed');
        return false;
      }
      
      const notices = await noticesResponse.json();
      console.log(`✅ Full stack test passed - ${notices.length} notices available`);
      
      return true;
    } catch (error) {
      console.log('❌ Full stack test failed:', error.message);
      return false;
    }
  }

  async execAsync(command) {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  }

  setupGracefulShutdown() {
    const shutdown = () => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;
      
      console.log('\n🛑 Shutting down gracefully...');
      
      this.processes.forEach((process, index) => {
        console.log(`Killing process ${index + 1}...`);
        process.kill('SIGTERM');
        
        // Force kill after 5 seconds
        setTimeout(() => {
          if (!process.killed) {
            process.kill('SIGKILL');
          }
        }, 5000);
      });
      
      setTimeout(() => {
        process.exit(0);
      }, 6000);
    };
    
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('exit', shutdown);
  }

  async start() {
    console.log('🎯 Starting Neighbourhood Watch App...\n');
    
    this.setupGracefulShutdown();
    
    try {
      // Step 1: Clean up existing processes
      await this.killExistingProcesses();
      
      // Step 2: Test database
      const dbOk = await this.testDatabase();
      if (!dbOk) {
        console.log('❌ Cannot start without database connection');
        return;
      }
      
      // Step 3: Start backend
      const backendOk = await this.startBackend();
      if (!backendOk) {
        console.log('❌ Cannot start without backend server');
        return;
      }
      
      // Step 4: Start frontend
      await this.startFrontend();
      
      // Step 5: Test full stack
      const fullStackOk = await this.testFullStack();
      
      if (fullStackOk) {
        console.log('\n🎉 Application started successfully!');
        console.log('📱 Frontend: http://localhost:3000');
        console.log('🔧 Backend: http://localhost:5001');
        console.log('\n💡 Login credentials:');
        console.log('   Email: admin@neighbourhood.com');
        console.log('   Password: admin123');
        console.log('\n🔄 Press Ctrl+C to stop all servers');
      } else {
        console.log('\n⚠️ Application started but full stack test failed');
        console.log('   Check the logs above for issues');
      }
      
      // Keep the process alive
      process.stdin.resume();
      
    } catch (error) {
      console.error('❌ Failed to start application:', error);
      process.exit(1);
    }
  }
}

// Start the application
const starter = new AppStarter();
starter.start();