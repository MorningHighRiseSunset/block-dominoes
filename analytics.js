// Vercel Web Analytics initialization
// This file initializes Vercel Web Analytics for the project
// Documentation: https://vercel.com/docs/analytics/quickstart
//
// For vanilla HTML/JavaScript projects without a bundler,
// we initialize analytics using the inject() function from @vercel/analytics
// This script should be loaded as a module in HTML files

import { inject } from './analytics-lib.mjs';

// Initialize Vercel Web Analytics
inject();
