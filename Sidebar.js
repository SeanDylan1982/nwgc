import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
  IconButton,
  Tooltip,
  useTheme,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import icons from '../../components/Common/Icons';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';

const drawerWidthExpanded = 240;
const drawerWidthCollapsed = 50;

const menuItems = [
  { text: 'Dashboard', icon: <icons.Dashboard size={24} />, path: '/dashboard' },
  { text: 'Chat', icon: <icons.Chat size={24} />, path: '/chat' },
  { text: 'Private Messages', icon: <icons.Message size={24} />, path: '/private-chat' },
  { text: 'Notice Board', icon: <icons.Campaign size={24} />, path: '/notices' },
  { text: 'Reports', icon: <icons.Report size={24} />, path: '/reports' },
  { text: 'Contacts', icon: <icons.Contacts size={24} />, path: '/contacts' },
];

const getBottomMenuItems = (userRole) => {
  const items = [
    { text: 'Profile', icon: <icons.Person size={24} />, path: '/profile' },
    { text: 'Settings', icon: <icons.Settings size={24} />, path: '/settings' },
  ];
  
  if (userRole === 'admin') {
    items.unshift({ text: 'Admin Panel', icon: <icons.AdminPanelSettings size={24} />, path: '/admin' });
  }
  
  return items;
};

const Sidebar = ({ open, onClose, collapsed, onToggleCollapse }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const theme = useTheme();

  // Save sidebar state preference when it changes
  useEffect(() => {
    const saveSidebarPreference = async () => {
      try {
        await axios.put('/api/settings/interface', {
          sidebarExpanded: !collapsed
        });
      } catch (error) {
        console.error('Error saving sidebar preference:', error);
      }
    };

    // Only save if the user is logged in and the sidebar state has changed
    if (user) {
      saveSidebarPreference();
    }
  }, [collapsed, user]);

  const handleNavigation = (path) => {
    navigate(path);
    if (window.innerWidth < theme.breakpoints.values.md) {
      onClose();
    }
  };

  const renderMenuItems = (items) => {
    return items.map((item) => (
      <ListItem key={item.text} disablePadding>
        <Tooltip title={collapsed ? item.text : ""} placement="right" arrow>
          <ListItemButton
            selected={location.pathname === item.path}
            onClick={() => handleNavigation(item.path)}
            sx={{
              minHeight: 48,
              justifyContent: collapsed ? 'center' : 'initial',
              px: 2.5,
              '&.Mui-selected': {
                backgroundColor: 'primary.light',
                color: 'primary.contrastText',
                '&:hover': {
                  backgroundColor: 'primary.main',
                },
              },
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 0,
                mr: collapsed ? 'auto' : 3,
                justifyContent: 'center',
                color: location.pathname === item.path ? 'inherit' : 'text.secondary',
              }}
            >
              {item.icon}
            </ListItemIcon>
            {!collapsed && <ListItemText primary={item.text} />}
          </ListItemButton>
        </Tooltip>
      </ListItem>
    ));
  };

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ 
        p: 1, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: collapsed ? 'center' : 'flex-end' 
      }}>
        <IconButton onClick={onToggleCollapse}>
          {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </IconButton>
      </Box>
      
      <Divider />
      
      <List sx={{ flex: 1 }}>
        {renderMenuItems(menuItems)}
      </List>

      <Divider />
      
      <List>
        {renderMenuItems(getBottomMenuItems(user?.role))}
      </List>
    </Box>
  );

  return (
    <Drawer
      variant="persistent"
      anchor="left"
      open={open}
      sx={{
        width: collapsed ? drawerWidthCollapsed : drawerWidthExpanded,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: collapsed ? drawerWidthCollapsed : drawerWidthExpanded,
          boxSizing: 'border-box',
          position: 'relative',
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
          overflowX: 'hidden',
        },
      }}
    >
      {drawer}
    </Drawer>
  );
};

export default Sidebar;