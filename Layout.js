import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import {
  Box,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import TopBar from './TopBar';
import Sidebar from './Sidebar';
import BottomNavigation from './BottomNavigation';
import FloatingActionButton from '../Common/FloatingActionButton';
import OfflineOperationManager from '../Common/OfflineOperationManager';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

const Layout = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true); // Default to collapsed
  const { user } = useAuth();

  // Load user preference for sidebar state
  useEffect(() => {
    const loadSidebarPreference = async () => {
      try {
        if (user) {
          const response = await axios.get('/api/settings/interface');
          if (response.data && response.data.sidebarExpanded !== undefined) {
            setSidebarCollapsed(!response.data.sidebarExpanded);
          }
        }
      } catch (error) {
        console.error('Error loading sidebar preference:', error);
      }
    };

    loadSidebarPreference();
  }, [user]);

  const handleSidebarToggle = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleSidebarCollapseToggle = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TopBar 
        onMenuClick={handleSidebarToggle} 
        isSidebarCollapsed={sidebarCollapsed}
        onSidebarCollapseToggle={handleSidebarCollapseToggle}
      />
      
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {!isMobile && (
          <Sidebar 
            open={sidebarOpen} 
            onClose={() => setSidebarOpen(false)} 
            collapsed={sidebarCollapsed}
            onToggleCollapse={handleSidebarCollapseToggle}
          />
        )}
        
        <Box
          component="main"
          sx={{
            flex: 1,
            overflow: 'auto',
            p: isMobile ? 1 : 3,
            pb: isMobile ? 8 : 3, // Extra padding for bottom nav on mobile
          }}
        >
          <Outlet />
        </Box>
      </Box>

      {isMobile && <BottomNavigation />}
      <FloatingActionButton />
      <OfflineOperationManager onProcessQueue={() => {
        // This will be handled by individual components using useDataSync
        console.log('Processing offline queue from Layout');
        return Promise.resolve();
      }} />
    </Box>
  );
};

export default Layout;