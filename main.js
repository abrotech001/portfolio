// Import necessary modules
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const axios = require('axios');
const session = require('express-session');
const MemoryStore = require('memorystore')(session); // Import memorystore

// Initialize environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('view')); // Serve static files from the public directory

// Session configuration with memorystore
app.use(session({
    secret: process.env.SESSION_SECRET || 'aB3$fG7@kL9!mN2#pQ5&rS8*uV1%wX4^', // Use environment variable
    resave: false, // Do not resave the session if it hasn't changed
    saveUninitialized: true, // Save new sessions
    store: new MemoryStore({
        checkPeriod: 86400000 // Prune expired entries every 24 hours
    }),
    cookie: { 
        secure: false, // Set to true if using HTTPS
        maxAge: 86400000 // Cookie expires in 24 hours
    }
}));

const SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY || '6Ld9feYqAAAAACwOzX_TCtua02YBABFAQj_dgB7D'; // Use environment variable

// Serve the gateway page
app.get('/gateway', (req, res) => {
    res.sendFile(path.join(__dirname, 'view', 'gateway.html'));
});

// Handle reCAPTCHA verification
app.post('/verify-human', async (req, res) => {
    const token = req.body['g-recaptcha-response'];

    if (!token) {
        return res.status(400).send('reCAPTCHA verification failed. Please try again.');
    }

    const verificationURL = `https://www.google.com/recaptcha/api/siteverify?secret=${SECRET_KEY}&response=${token}`;

    try {
        const response = await axios.post(verificationURL);
        const { success } = response.data;

        if (success) {
            // Set session flag
            req.session.humanVerified = true;
            console.log('Session after verification:', req.session); // Debugging
            res.redirect('/'); // Redirect to the main page
        } else {
            res.status(400).send('reCAPTCHA verification failed. Are you a robot?');
        }
    } catch (error) {
        console.error('Error verifying reCAPTCHA:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Middleware to check verification
app.use((req, res, next) => {
    console.log('Session in middleware:', req.session); // Debugging

    // Allow access to the gateway page and verification route
    if (req.path === '/gateway' || req.path === '/verify-human') {
        return next();
    }

    // Check if the user is verified using the session
    if (!req.session.humanVerified) {
        return res.redirect('/gateway'); // Redirect unverified users to the gateway page
    }

    // Allow verified users to access the requested route
    next();
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'view', 'index.html')); // Serve your payment page
});

// Serve the PDF file
app.get('/packages/pdf/', (req, res) => {
    res.sendFile(path.join(__dirname, 'pdf', 'portfolio.pdf'));
});

// Catch-all route for undefined pages
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'view', 'error.html'));
});

// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Start the server
const port = process.env.PORT || 8000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
