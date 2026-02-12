const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const { protect, tenantIsolation } = require('../middleware/auth');
const { createNotificationWithEmail } = require('../utils/notifications');

// @route   GET /api/tasks
// @desc    Get all tasks user has access to
// @access  Private
router.get('/', protect, tenantIsolation, async (req, res) => {
  try {
    const { projectId, teamId, assignedTo, status, priority, search } = req.query;
    const query = {
      companyId: req.user.companyId
    };

    // For board/project/team view, show all tasks
    // For my tasks view, filter by assignedTo or createdBy
    if (projectId || teamId) {
      if (projectId) query.projectId = projectId;
      if (teamId) query.teamId = teamId;
    } else {
      query.$or = [
        { assignedTo: req.user.id },
        { createdBy: req.user.id }
      ];
    }
    if (assignedTo) query.assignedTo = assignedTo;
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const tasks = await Task.find(query)
      .populate('assignedTo', 'firstName lastName email avatar')
      .populate('createdBy', 'firstName lastName email avatar')
      .populate('projectId', 'name color')
      .populate('teamId', 'name color')
      .populate('sectionId', 'name color')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: tasks.length,
      data: tasks
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/tasks/:id
// @desc    Get single task
// @access  Private
router.get('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    })
      .populate('assignedTo', 'firstName lastName email avatar')
      .populate('createdBy', 'firstName lastName email avatar')
      .populate('projectId', 'name color')
      .populate('teamId', 'name color')
      .populate('sectionId', 'name color');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/tasks
// @desc    Create task
// @access  Private
router.post('/', protect, tenantIsolation, async (req, res) => {
  try {
    req.body.companyId = req.user.companyId;
    req.body.createdBy = req.user.id;

    const task = await Task.create(req.body);

    const populatedTask = await Task.findById(task._id)
      .populate('assignedTo', 'firstName lastName email avatar')
      .populate('createdBy', 'firstName lastName email avatar')
      .populate('projectId', 'name color')
      .populate('teamId', 'name color')
      .populate('sectionId', 'name color');

    // Notify assigned users
    if (populatedTask.assignedTo && populatedTask.assignedTo.length > 0) {
      for (const assignee of populatedTask.assignedTo) {
        if (assignee._id.toString() !== req.user.id) {
          await createNotificationWithEmail(
            req.user.companyId,
            assignee._id,
            'Task',
            'New Task Assigned',
            `You've been assigned to task "${task.title}"`,
            `/work/tasks/${task._id}`,
            { taskId: task._id, assignedBy: req.user.id }
          );
        }
      }
    }

    res.status(201).json({
      success: true,
      data: populatedTask
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   PUT /api/tasks/:id
// @desc    Update task
// @access  Private
router.put('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user is creator or assigned
    const isCreator = task.createdBy.toString() === req.user.id;
    const isAssigned = task.assignedTo.some(a => a.toString() === req.user.id);
    
    if (!isCreator && !isAssigned) {
      return res.status(403).json({ message: 'Not authorized to update this task' });
    }

    // Handle status change to completed
    if (req.body.status === 'Completed' && task.status !== 'Completed') {
      req.body.completedAt = new Date();
      req.body.completedBy = req.user.id;
    }

    const updated = await Task.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    })
      .populate('assignedTo', 'firstName lastName email avatar')
      .populate('createdBy', 'firstName lastName email avatar')
      .populate('projectId', 'name color')
      .populate('teamId', 'name color')
      .populate('sectionId', 'name color');

    // Notify newly assigned users
    if (req.body.assignedTo) {
      const newAssignees = req.body.assignedTo.filter(
        assigneeId => !task.assignedTo.some(a => a.toString() === assigneeId)
      );
      
      for (const assigneeId of newAssignees) {
        await createNotificationWithEmail(
          req.user.companyId,
          assigneeId,
          'Task',
          'Task Assigned',
          `You've been assigned to task "${updated.title}"`,
          `/work/tasks/${updated._id}`,
          { taskId: updated._id, assignedBy: req.user.id }
        );
      }
    }

    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   DELETE /api/tasks/:id
// @desc    Delete task
// @access  Private (Creator only)
router.delete('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (task.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only task creator can delete task' });
    }

    await task.deleteOne();

    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
