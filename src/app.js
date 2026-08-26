const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');

const { uploadsDir } = require('./db');

// Route modules
const publicRoutes = require('./routes/public');
const authRoutes = require('./routes/auth');
const webauthnRoutes = require('./routes/webauthn');
const adminRoutes = require('./routes/admin');

const app = express();

// Core Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static File Serving
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(path.join(__dirname, '..', 'public')));

// API Routes
app.use('/api', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/auth/webauthn', webauthnRoutes);
app.use('/api/admin', adminRoutes);

module.exports = app;

