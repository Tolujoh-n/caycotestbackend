const express = require('express');
const router = express.Router();
const Link = require('../models/Link');
const { protect, tenantIsolation } = require('../middleware/auth');
const { fetchLinkMetadata } = require('../utils/linkMetadata');

// @route   GET /api/links
// @desc    Get links for project/team/task
// @access  Private
router.get('/', protect, tenantIsolation, async (req, res) => {
  try {
    const { projectId, teamId, taskId, isKeyResource } = req.query;
    const query = { companyId: req.user.companyId };

    if (projectId) query.projectId = projectId;
    if (teamId) query.teamId = teamId;
    if (taskId) query.taskId = taskId;
    if (isKeyResource !== undefined) {
      query.isKeyResource = isKeyResource === 'true' || isKeyResource === true;
    }

    const links = await Link.find(query)
      .populate('addedBy', 'firstName lastName email avatar')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: links.length,
      data: links
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/links
// @desc    Add link (with metadata fetching)
// @access  Private
router.post('/', protect, tenantIsolation, async (req, res) => {
  try {
    const { url, projectId, teamId, taskId, tags } = req.body;

    if (!url) {
      return res.status(400).json({ message: 'URL is required' });
    }

    // Validate URL
    try {
      new URL(url);
    } catch (e) {
      return res.status(400).json({ message: 'Invalid URL format' });
    }

    // Fetch metadata
    let metadata = {};
    try {
      metadata = await fetchLinkMetadata(url);
    } catch (error) {
      console.error('Error fetching link metadata:', error);
      // Continue without metadata
    }

    const linkData = {
      companyId: req.user.companyId,
      url,
      addedBy: req.user.id,
      title: metadata.title || url,
      description: metadata.description || '',
      image: metadata.image || '',
      siteName: metadata.siteName || '',
      favicon: metadata.favicon || '',
      tags: tags || []
    };

    if (projectId) linkData.projectId = typeof projectId === 'string' ? projectId : String(projectId);
    if (teamId) linkData.teamId = typeof teamId === 'string' ? teamId : String(teamId);
    if (taskId) linkData.taskId = typeof taskId === 'string' ? taskId : String(taskId);
    if (req.body.isKeyResource !== undefined) {
      linkData.isKeyResource = req.body.isKeyResource === 'true' || req.body.isKeyResource === true;
    }

    const link = await Link.create(linkData);

    const populatedLink = await Link.findById(link._id)
      .populate('addedBy', 'firstName lastName email avatar');

    res.status(201).json({
      success: true,
      data: populatedLink
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   DELETE /api/links/:id
// @desc    Delete link
// @access  Private (uploader only)
router.delete('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const link = await Link.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!link) {
      return res.status(404).json({ message: 'Link not found' });
    }

    // Only the person who added the link can delete it
    if (link.addedBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only link adder can delete link' });
    }

    await link.deleteOne();

    res.json({
      success: true,
      message: 'Link deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
