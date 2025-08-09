import icons from '../Common/Icons'
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BottomNavigation as MuiBottomNavigation,
  BottomNavigationAction,
  Paper,
  Badge,
} from '@mui/material';

const navigationItems = [
  { label: 'Dashboard', icon: <icons.Dashboard />, path: '/dashboard' },
  { label: 'Chat', icon: <icons.Chat />, path: '/chat' },
  { label: 'Private', icon: <icons.Message />, path: '/private-chat' },
  { label: 'Notices', icon: <icons.Campaign />, path: '/notices' },
  { label: 'Reports', icon: <icons.Report />, path: '/reports' },
];

const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const currentIndex = navigationItems.findIndex(item => item.path === location.pathname);

  const handleChange = (event, newValue) => {
    navigate(navigationItems[newValue].path);
  };

  return (
    <Paper
      sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000 }}
      elevation={3}
    >
      <MuiBottomNavigation
        value={currentIndex >= 0 ? currentIndex : 0}
        onChange={handleChange}
        showLabels
      >
        {navigationItems.map((item, index) => (
          <BottomNavigationAction
            key={item.label}
            label={item.label}
            icon={item.icon}
            // Add badge for unread messages (example)
            icon={item.label === 'Private' ? (
              <Badge badgeContent={2} color="error">
                {item.icon}
              </Badge>
            ) : item.icon}
          />
        ))}
      </MuiBottomNavigation>
    </Paper>
  );
};

export default BottomNavigation;