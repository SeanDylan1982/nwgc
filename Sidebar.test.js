import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import Sidebar from '../components/Layout/Sidebar';
import { AuthProvider } from '../contexts/AuthContext';

// Mock axios
jest.mock('axios');

// Mock the icons
jest.mock('../components/Common/Icons', () => ({
  Dashboard: () => <div data-testid="dashboard-icon" />,
  Chat: () => <div data-testid="chat-icon" />,
  Message: () => <div data-testid="message-icon" />,
  Campaign: () => <div data-testid="campaign-icon" />,
  Report: () => <div data-testid="report-icon" />,
  Contacts: () => <div data-testid="contacts-icon" />,
  Person: () => <div data-testid="person-icon" />,
  Settings: () => <div data-testid="settings-icon" />,
  Palette: () => <div data-testid="palette-icon" />,
  AdminPanelSettings: () => <div data-testid="admin-icon" />,
}));

// Mock the auth context
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { role: 'user' },
  }),
  AuthProvider: ({ children }) => <div>{children}</div>,
}));

const theme = createTheme();

describe('Sidebar Component', () => {
  const renderSidebar = (props = {}) => {
    const defaultProps = {
      open: true,
      onClose: jest.fn(),
      collapsed: false,
      onToggleCollapse: jest.fn(),
    };
    
    return render(
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          <Sidebar {...defaultProps} {...props} />
        </ThemeProvider>
      </BrowserRouter>
    );
  };

  test('renders expanded sidebar with all menu items', () => {
    renderSidebar({ collapsed: false });
    
    // Check that all menu items are visible with text
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Chat')).toBeInTheDocument();
    expect(screen.getByText('Private Messages')).toBeInTheDocument();
    expect(screen.getByText('Notice Board')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('Contacts')).toBeInTheDocument();
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('3D Icons')).toBeInTheDocument();
  });

  test('renders collapsed sidebar without text', () => {
    renderSidebar({ collapsed: true });
    
    // Check that icons are visible but text is not
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Chat')).not.toBeInTheDocument();
    expect(screen.getByTestId('dashboard-icon')).toBeInTheDocument();
    expect(screen.getByTestId('chat-icon')).toBeInTheDocument();
  });

  test('calls onToggleCollapse when toggle button is clicked', () => {
    const onToggleCollapse = jest.fn();
    renderSidebar({ onToggleCollapse });
    
    // Find and click the toggle button
    const toggleButton = screen.getByRole('button');
    fireEvent.click(toggleButton);
    
    expect(onToggleCollapse).toHaveBeenCalledTimes(1);
  });

  test('shows admin panel for admin users', () => {
    // Override the mock to return admin user
    jest.spyOn(require('../contexts/AuthContext'), 'useAuth').mockImplementation(() => ({
      user: { role: 'admin' },
    }));
    
    renderSidebar();
    
    expect(screen.getByText('Admin Panel')).toBeInTheDocument();
  });

  test('navigates when menu item is clicked', () => {
    renderSidebar();
    
    // Click on Dashboard
    fireEvent.click(screen.getByText('Dashboard'));
    
    // Check that we're on the dashboard route
    expect(window.location.pathname).toBe('/dashboard');
  });
});