const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { requireRole } = require('../middleware/auth');
const router = express.Router();

// Get current user's neighbourhood
router.get('/me', async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(`
      SELECT n.*, u.role as user_role,
             (SELECT COUNT(*) FROM users WHERE neighbourhood_id = n.id AND is_active = true) as member_count
      FROM neighbourhoods n
      JOIN users u ON n.id = u.neighbourhood_id
      WHERE u.id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not assigned to a neighbourhood' });
    }

    const neighbourhood = result.rows[0];
    res.json({
      id: neighbourhood.id,
      name: neighbourhood.name,
      description: neighbourhood.description,
      address: neighbourhood.address,
      city: neighbourhood.city,
      state: neighbourhood.state,
      zipCode: neighbourhood.zip_code,
      country: neighbourhood.country,
      latitude: neighbourhood.latitude,
      longitude: neighbourhood.longitude,
      radiusMeters: neighbourhood.radius_meters,
      isActive: neighbourhood.is_active,
      memberCount: parseInt(neighbourhood.member_count),
      userRole: neighbourhood.user_role,
      createdAt: neighbourhood.created_at
    });
  } catch (error) {
    console.error('Get neighbourhood error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all neighbourhoods (admin only)
router.get('/', requireRole(['admin']), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT n.*,
             (SELECT COUNT(*) FROM users WHERE neighbourhood_id = n.id AND is_active = true) as member_count,
             u.first_name || ' ' || u.last_name as created_by_name
      FROM neighbourhoods n
      LEFT JOIN users u ON n.created_by = u.id
      ORDER BY n.created_at DESC
    `);

    const neighbourhoods = result.rows.map(n => ({
      id: n.id,
      name: n.name,
      description: n.description,
      address: n.address,
      city: n.city,
      state: n.state,
      zipCode: n.zip_code,
      country: n.country,
      latitude: n.latitude,
      longitude: n.longitude,
      radiusMeters: n.radius_meters,
      isActive: n.is_active,
      memberCount: parseInt(n.member_count),
      createdBy: n.created_by_name,
      createdAt: n.created_at
    }));

    res.json(neighbourhoods);
  } catch (error) {
    console.error('Get neighbourhoods error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new neighbourhood (admin only)
router.post('/', requireRole(['admin']), [
  body('name').trim().isLength({ min: 1, max: 255 }),
  body('description').optional().trim(),
  body('address').optional().trim(),
  body('city').optional().trim().isLength({ max: 100 }),
  body('state').optional().trim().isLength({ max: 50 }),
  body('zipCode').optional().trim().isLength({ max: 10 }),
  body('country').optional().trim().isLength({ max: 50 }),
  body('latitude').optional().isFloat({ min: -90, max: 90 }),
  body('longitude').optional().isFloat({ min: -180, max: 180 }),
  body('radiusMeters').optional().isInt({ min: 100, max: 10000 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      description,
      address,
      city,
      state,
      zipCode,
      country = 'USA',
      latitude,
      longitude,
      radiusMeters = 1000
    } = req.body;

    const userId = req.user.userId;

    const result = await pool.query(`
      INSERT INTO neighbourhoods (
        name, description, address, city, state, zip_code, country,
        latitude, longitude, radius_meters, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      name, description, address, city, state, zipCode, country,
      latitude, longitude, radiusMeters, userId
    ]);

    const neighbourhood = result.rows[0];

    res.status(201).json({
      id: neighbourhood.id,
      name: neighbourhood.name,
      description: neighbourhood.description,
      address: neighbourhood.address,
      city: neighbourhood.city,
      state: neighbourhood.state,
      zipCode: neighbourhood.zip_code,
      country: neighbourhood.country,
      latitude: neighbourhood.latitude,
      longitude: neighbourhood.longitude,
      radiusMeters: neighbourhood.radius_meters,
      isActive: neighbourhood.is_active,
      createdAt: neighbourhood.created_at
    });
  } catch (error) {
    console.error('Create neighbourhood error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update neighbourhood (admin only)
router.put('/:id', requireRole(['admin']), [
  body('name').optional().trim().isLength({ min: 1, max: 255 }),
  body('description').optional().trim(),
  body('address').optional().trim(),
  body('city').optional().trim().isLength({ max: 100 }),
  body('state').optional().trim().isLength({ max: 50 }),
  body('zipCode').optional().trim().isLength({ max: 10 }),
  body('country').optional().trim().isLength({ max: 50 }),
  body('latitude').optional().isFloat({ min: -90, max: 90 }),
  body('longitude').optional().isFloat({ min: -180, max: 180 }),
  body('radiusMeters').optional().isInt({ min: 100, max: 10000 }),
  body('isActive').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const neighbourhoodId = req.params.id;
    const updateData = req.body;
    const userId = req.user.userId;

    const updateFields = [];
    const values = [];
    let paramCount = 0;

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        paramCount++;
        const dbField = key === 'zipCode' ? 'zip_code' : 
                       key === 'radiusMeters' ? 'radius_meters' :
                       key === 'isActive' ? 'is_active' : key;
        updateFields.push(`${dbField} = $${paramCount}`);
        values.push(updateData[key]);
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(neighbourhoodId);

    const query = `
      UPDATE neighbourhoods 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount + 1}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Neighbourhood not found' });
    }

    // Log the action
    await pool.query(`
      INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      userId,
      'update_neighbourhood',
      'neighbourhood',
      neighbourhoodId,
      JSON.stringify(updateData)
    ]);

    const neighbourhood = result.rows[0];
    res.json({
      id: neighbourhood.id,
      name: neighbourhood.name,
      description: neighbourhood.description,
      address: neighbourhood.address,
      city: neighbourhood.city,
      state: neighbourhood.state,
      zipCode: neighbourhood.zip_code,
      country: neighbourhood.country,
      latitude: neighbourhood.latitude,
      longitude: neighbourhood.longitude,
      radiusMeters: neighbourhood.radius_meters,
      isActive: neighbourhood.is_active,
      updatedAt: neighbourhood.updated_at
    });
  } catch (error) {
    console.error('Update neighbouurhood error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get neighbourhood statistics
router.get('/:id/stats', async (req, res) => {
  try {
    const neighbourhoodId = req.params.id;
    const userId = req.user.userId;

    // Verify user has access to this neighbourhood
    const accessCheck = await pool.query(
      'SELECT 1 FROM users WHERE id = $1 AND (neighbourhood_id = $2 OR role = $3)',
      [userId, neighbourhoodId, 'admin']
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get various statistics
    const [
      memberStats,
      reportStats,
      noticeStats,
      chatStats
    ] = await Promise.all([
      pool.query(`
        SELECT 
          COUNT(*) as total_members,
          COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins,
          COUNT(CASE WHEN role = 'moderator' THEN 1 END) as moderators,
          COUNT(CASE WHEN is_verified = true THEN 1 END) as verified_members
        FROM users 
        WHERE neighbourhood_id = $1 AND is_active = true
      `, [neighbourhoodId]),
      
      pool.query(`
        SELECT 
          COUNT(*) as total_reports,
          COUNT(CASE WHEN status = 'open' THEN 1 END) as open_reports,
          COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_reports,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as recent_reports
        FROM reports 
        WHERE neighbourhood_id = $1
      `, [neighbourhoodId]),
      
      pool.query(`
        SELECT 
          COUNT(*) as total_notices,
          COUNT(CASE WHEN is_pinned = true THEN 1 END) as pinned_notices,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as recent_notices
        FROM notices 
        WHERE neighbourhood_id = $1 AND is_active = true
      `, [neighbourhoodId]),
      
      pool.query(`
        SELECT 
          COUNT(DISTINCT cg.id) as total_groups,
          COUNT(DISTINCT cgm.user_id) as active_chatters,
          COUNT(m.id) as total_messages
        FROM chat_groups cg
        LEFT JOIN chat_group_members cgm ON cg.id = cgm.group_id
        LEFT JOIN messages m ON cg.id = m.group_id
        WHERE cg.neighbourhood_id = $1 AND cg.is_active = true
      `, [neighbouurhoodId])
    ]);

    res.json({
      members: memberStats.rows[0],
      reports: reportStats.rows[0],
      notices: noticeStats.rows[0],
      chat: chatStats.rows[0]
    });
  } catch (error) {
    console.error('Get neighbourhood stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;