const express = require('express');
const { ObjectId } = require('mongodb');
const database = require('../database/connection');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorHandler');
const bcrypt = require('bcryptjs');

const router = express.Router();

// Apply auth middleware to all routes
router.use(verifyToken);

// Get settings
router.get('/', checkRole('ADMIN'), asyncHandler(async (req, res) => {
  try {
    // Get settings from database or return defaults
    let settings = await database.findOne('settings', {});
    
    if (!settings) {
      // Create default settings if none exist
      settings = {
        general: {
          companyName: 'FWC HRMS',
          companyEmail: 'info@fwchrms.com',
          companyPhone: '',
          timezone: 'UTC',
          dateFormat: 'MM/DD/YYYY',
          timeFormat: '12h',
          language: 'en'
        },
        security: {
          passwordMinLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: false,
          sessionTimeout: 30, // minutes
          maxLoginAttempts: 5,
          lockoutDuration: 15 // minutes
        },
        notifications: {
          emailNotifications: true,
          smsNotifications: false,
          pushNotifications: true,
          notifyOnLeaveRequest: true,
          notifyOnAttendance: true,
          notifyOnPayroll: true,
          notifyOnPerformance: true
        },
        appearance: {
          theme: 'light',
          primaryColor: '#3B82F6',
          sidebarCollapsed: false,
          compactMode: false
        },
        integrations: {
          emailProvider: 'resend',
          smsProvider: null,
          calendarSync: false,
          slackIntegration: false
        },
        backup: {
          autoBackup: true,
          backupFrequency: 'daily',
          retentionDays: 30,
          lastBackup: null
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await database.insertOne('settings', settings);
      settings._id = result.insertedId;
    }

    res.json({
      success: true,
      settings: settings
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settings',
      error: error.message
    });
  }
}));

// Update settings
router.put('/', checkRole('ADMIN'), asyncHandler(async (req, res) => {
  try {
    const updateData = req.body;
    
    // Get existing settings
    let settings = await database.findOne('settings', {});
    
    if (!settings) {
      // Create if doesn't exist
      settings = {
        general: {},
        security: {},
        notifications: {},
        appearance: {},
        integrations: {},
        backup: {},
        createdAt: new Date()
      };
      const result = await database.insertOne('settings', settings);
      settings._id = result.insertedId;
    }

    // Merge updates
    const updatedSettings = {
      ...settings,
      ...updateData,
      updatedAt: new Date()
    };

    // Update in database
    await database.updateOne(
      'settings',
      { _id: settings._id },
      { $set: updatedSettings }
    );

    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings: updatedSettings
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update settings',
      error: error.message
    });
  }
}));

// Change password
router.post('/change-password', checkRole('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'), asyncHandler(async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user._id || req.user.userId;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long'
      });
    }

    // Get user from database
    const user = await database.findOne('users', {
      _id: ObjectId.isValid(userId) ? new ObjectId(userId) : userId
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await database.updateOne(
      'users',
      { _id: user._id },
      { $set: { password: hashedPassword, updatedAt: new Date() } }
    );

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: error.message
    });
  }
}));

// Get integrations
router.get('/integrations', checkRole('ADMIN'), asyncHandler(async (req, res) => {
  try {
    const settings = await database.findOne('settings', {});
    
    const integrations = settings?.integrations || {
      emailProvider: 'resend',
      smsProvider: null,
      calendarSync: false,
      slackIntegration: false,
      availableIntegrations: [
        { id: 'resend', name: 'Resend Email', type: 'email', enabled: true },
        { id: 'slack', name: 'Slack', type: 'communication', enabled: false },
        { id: 'google-calendar', name: 'Google Calendar', type: 'calendar', enabled: false },
        { id: 'microsoft-teams', name: 'Microsoft Teams', type: 'communication', enabled: false }
      ]
    };

    res.json({
      success: true,
      integrations: integrations
    });
  } catch (error) {
    console.error('Error fetching integrations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch integrations',
      error: error.message
    });
  }
}));

// Connect integration
router.post('/integrations/:provider', checkRole('ADMIN'), asyncHandler(async (req, res) => {
  try {
    const { provider } = req.params;
    const config = req.body;

    let settings = await database.findOne('settings', {});
    
    if (!settings) {
      settings = {
        general: {},
        security: {},
        notifications: {},
        appearance: {},
        integrations: {},
        backup: {},
        createdAt: new Date()
      };
      const result = await database.insertOne('settings', settings);
      settings._id = result.insertedId;
    }

    // Update integration config
    const updatedIntegrations = {
      ...(settings.integrations || {}),
      [provider]: {
        ...config,
        enabled: true,
        connectedAt: new Date()
      }
    };

    await database.updateOne(
      'settings',
      { _id: settings._id },
      { 
        $set: { 
          integrations: updatedIntegrations,
          updatedAt: new Date()
        } 
      }
    );

    res.json({
      success: true,
      message: `${provider} integration connected successfully`,
      integrations: updatedIntegrations
    });
  } catch (error) {
    console.error('Error connecting integration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to connect integration',
      error: error.message
    });
  }
}));

module.exports = router;

