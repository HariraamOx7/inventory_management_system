const State = require('../models/State');
const { literal } = require('sequelize');

exports.getStates = async (req, res) => {
    try {
        const states = await State.findAll({
            order: [[literal('CAST(StateCode AS SIGNED)'), 'ASC']]
        });
        res.json({
            success: true,
            data: states
        });
    } catch (error) {
        console.error('Error fetching states:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching states',
            error: error.message 
        });
    }
};

exports.addState = async (req, res) => {
    try {
        const { StateName } = req.body;
        
        if (!StateName) {
            return res.status(400).json({
                success: false,
                message: 'State Name is required'
            });
        }
        
        // Generate StateCode automatically
        const lastState = await State.findOne({
            order: [[literal('CAST(StateCode AS SIGNED)'), 'DESC']]
        });
        const newStateCode = (lastState ? parseInt(lastState.StateCode) + 1 : 1).toString();
        
        const newState = await State.create({ 
            StateCode: newStateCode,
            StateName: StateName.trim()
        });
        
        res.status(201).json({
            success: true,
            data: newState
        });
    } catch (error) {
        console.error('Error adding state:', error);
        
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({
                success: false,
                message: 'State with this name already exists',
                error: error.message
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Error adding state',
            error: error.message 
        });
    }
};

exports.updateState = async (req, res) => {
    try {
        const { code } = req.params;
        const { StateName } = req.body;

        if (!StateName || StateName.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'State Name is required'
            });
        }

        const state = await State.findByPk(code);
        if (!state) {
            return res.status(404).json({
                success: false,
                message: 'State not found'
            });
        }

        await state.update({ 
            StateName: StateName.trim()
        });

        res.json({
            success: true,
            data: state
        });
    } catch (error) {
        console.error('Error updating state:', error);
        
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({
                success: false,
                message: 'State with this name already exists',
                error: error.message
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Error updating state',
            error: error.message
        });
    }
};

exports.deleteState = async (req, res) => {
    try {
        const { code } = req.params;
        
        const state = await State.findByPk(code);
        if (!state) {
            return res.status(404).json({
                success: false,
                message: 'State not found'
            });
        }

        await state.destroy();

        res.json({
            success: true,
            message: 'State deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting state:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting state',
            error: error.message
        });
    }
};