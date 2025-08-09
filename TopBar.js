import icons from '../Common/Icons'
import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Badge,
  Menu,
  MenuItem,
  Avatar,
  Box,
  useTheme,
  useMediaQuery,
  Divider,
  Tooltip,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Notifications as NotificationsIcon,
  AccountCircle,
  Logout,
  Settings,
  Storage as StorageIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import DataSyncIndicator from '../Common/DataSyncIndicator';
import DatabaseHealthIndicator from '../Common/DatabaseHealthIndicator';
import SearchBar from '../Search/SearchBar';
import useSearchNavigation from '../../hooks/useSearchNavigation';
import PageActionButton from '../Common/PageActionButton';
import * as offlineQueue from '../../utils/offlineOperationQueue';

const TopBar = ({ onMenuClick, isSidebarCollapsed, onSidebarCollapseToggle }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [pendingOperations, setPendingOperations] = useState([]);
  const { navigateToResult } = useSearchNavigation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Monitor offline queue
  useEffect(() => {
    const updateQueue = () => {
      setPendingOperations(offlineQueue.getQueue());
    };
    
    // Update initial state
    updateQueue();
    
    // Listen for queue events
    window.addEventListener('offline:operation-queued', updateQueue);
    window.addEventListener('offline:operation-removed', updateQueue);
    window.addEventListener('offline:queue-cleared', updateQueue);
    window.addEventListener('offline:processing-started', updateQueue);
    window.addEventListener('offline:processing-completed', updateQueue);
    
    return () => {
      window.removeEventListener('offline:operation-queued', updateQueue);
      window.removeEventListener('offline:operation-removed', updateQueue);
      window.removeEventListener('offline:queue-cleared', updateQueue);
      window.removeEventListener('offline:processing-started', updateQueue);
      window.removeEventListener('offline:processing-completed', updateQueue);
    };
  }, []);
  
  // Update sync status based on online status
  useEffect(() => {
    const handleOnline = () => setSyncStatus('idle');
    const handleOffline = () => setSyncStatus('offline');
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Set initial status
    setSyncStatus(navigator.onLine ? 'idle' : 'offline');
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    handleMenuClose();
    navigate('/login');
  };

  const handleProfile = () => {
    navigate('/profile');
    handleMenuClose();
  };

  const handleSettings = () => {
    navigate('/settings');
    handleMenuClose();
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const handleMobileNavigation = (path) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  // Mobile menu items
  const mobileMenuItems = [
    { text: 'Dashboard', icon: <icons.Dashboard />, path: '/dashboard' },
    { text: 'Chat', icon: <icons.Chat />, path: '/chat' },
    { text: 'Private Messages', icon: <icons.Message />, path: '/private-chat' },
    { text: 'Notice Board', icon: <icons.Campaign />, path: '/notices' },
    { text: 'Reports', icon: <icons.Report />, path: '/reports' },
    { text: 'Contacts', icon: <icons.Contacts />, path: '/contacts' },
    { text: 'Profile', icon: <icons.Person />, path: '/profile' },
    { text: 'Settings', icon: <icons.Settings />, path: '/settings' },
  ];

  if (user?.role === 'admin') {
    mobileMenuItems.push({ text: 'Admin Panel', icon: <icons.AdminPanelSettings />, path: '/admin' });
  }

  return (
    <>
      <AppBar position="static" elevation={1}>
        <Toolbar>
          {isMobile ? (
            <IconButton
              edge="start"
              color="inherit"
              aria-label="menu"
              onClick={toggleMobileMenu}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          ) : (
            <IconButton
              edge="start"
              color="inherit"
              aria-label="menu"
              onClick={onMenuClick}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          
          <Typography variant="h6" component="div" sx={{ display: { xs: 'block', sm: 'block', md: 'block' }, mr: 2 }}>
            NeighbourWatch
          </Typography>

          {/* Search Bar */}
          <Box sx={{ flexGrow: 1, display: { xs: 'none', sm: 'none', md: 'block' } }}>
            <SearchBar 
              placeholder="Search people, notices, reports, chats..." 
              onResultSelect={navigateToResult}
            />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Page-specific action button */}
            <PageActionButton 
              onAction={(actionType) => {
                // Handle page-specific actions
                console.log('Page action triggered:', actionType);
                // This can be expanded to handle specific actions per page
              }}
            />
            
            <DataSyncIndicator 
              syncStatus={syncStatus} 
              pendingOperations={pendingOperations}
              onProcessQueue={() => {
                // This will be handled by individual components using useDataSync
                console.log('Processing offline queue from TopBar');
                return Promise.resolve();
              }}
            />
            
            {/* Only show database health indicator for admin users */}
            {user?.role === 'admin' && (
              <Box sx={{ mx: 1 }}>
                <DatabaseHealthIndicator size="small" />
              </Box>
            )}
            
            <IconButton color="inherit">
              <Badge badgeContent={4} color="error">
                <icons.Notifications />
              </Badge>
            </IconButton>

            <IconButton
              edge="end"
              aria-label="account of current user"
              aria-controls="primary-search-account-menu"
              aria-haspopup="true"
              onClick={handleProfileMenuOpen}
              color="inherit"
            >
              <Avatar
                src={user?.profile_image_url}
                alt={user?.first_name}
                sx={{ width: 32, height: 32 }}
              >
                {user?.first_name?.[0]?.toUpperCase()}
              </Avatar>
            </IconButton>
          </Box>

          <Menu
            anchorEl={anchorEl}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            keepMounted
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={handleProfile}>
              <AccountCircle sx={{ mr: 1 }} />
              Profile
            </MenuItem>
            <MenuItem onClick={handleSettings}>
              <icons.Settings sx={{ mr: 1 }} />
              Settings
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <Logout sx={{ mr: 1 }} />
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Mobile Hamburger Menu */}
      <Drawer
        anchor="left"
        open={mobileMenuOpen}
        onClose={toggleMobileMenu}
        sx={{
          '& .MuiDrawer-paper': {
            width: 240,
            boxSizing: 'border-box',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6">Menu</Typography>
        </Box>
        <Divider />
        <List>
          {mobileMenuItems.map((item) => (
            <ListItem 
              button 
              key={item.text} 
              onClick={() => handleMobileNavigation(item.path)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItem>
          ))}
        </List>
      </Drawer>
    </>
  );
};

export default TopBar;