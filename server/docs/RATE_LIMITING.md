# Rate Limiting Configuration

This document explains how to configure rate limiting for the Neighbourhood Watch application.

## Overview

The application uses two-tier rate limiting:

1. **General Rate Limiting**: Applied to all API endpoints
2. **Admin Rate Limiting**: Higher limits for admin and database metrics endpoints

## Default Limits

- **General**: 100 requests per 15 minutes per IP
- **Admin**: 1000 requests per 15 minutes per IP/user

## Configuration

### Environment Variables

Add these to your `.env.local` file:

```env
# Rate limiting window (milliseconds) - default: 15 minutes
RATE_LIMIT_WINDOW_MS=900000

# General rate limit (requests per window)
RATE_LIMIT_MAX=100

# Admin rate limit (requests per window)
ADMIN_RATE_LIMIT_MAX=1000
```

### Quick Configuration

Use the configuration helper script:

```bash
# For development
npm run configure-rate-limits development

# For small production (< 100 users)
npm run configure-rate-limits production_small

# For medium production (100-1000 users)
npm run configure-rate-limits production_medium

# For large production (> 1000 users)
npm run configure-rate-limits production_large

# For high traffic with monitoring dashboards
npm run configure-rate-limits high_traffic
```

## Scenarios

### Development
- General: 200 requests/15min
- Admin: 1000 requests/15min
- Best for: Local development and testing

### Production Small
- General: 100 requests/15min
- Admin: 500 requests/15min
- Best for: Small deployments with < 100 users

### Production Medium
- General: 300 requests/15min
- Admin: 1500 requests/15min
- Best for: Medium deployments with 100-1000 users

### Production Large
- General: 1000 requests/15min
- Admin: 5000 requests/15min
- Best for: Large deployments with > 1000 users

### High Traffic
- General: 2000 requests/15min
- Admin: 10000 requests/15min
- Best for: High traffic deployments with active monitoring

## Admin Endpoints

The following endpoints use the higher admin rate limits:

- `/api/admin/*` - All admin management endpoints
- `/api/database-metrics/*` - Database health monitoring endpoints

## Database Health Dashboard

The database health dashboard has been optimized to reduce API calls:

- **Auto-refresh**: Every 2 minutes (reduced from 1 minute)
- **Request caching**: 1-minute cache for detailed metrics
- **Rate limit handling**: Graceful error messages for rate limit exceeded

## Troubleshooting

### "Too many requests" Error

If you see this error:

1. **Check your rate limits**: Ensure they're appropriate for your usage
2. **Increase limits**: Use the configuration script or manually update `.env.local`
3. **Monitor usage**: Check if there are unnecessary API calls
4. **Restart server**: Changes require a server restart

### Database Health Dashboard Issues

If the dashboard shows rate limiting errors:

1. **Use high_traffic scenario**: `npm run configure-rate-limits high_traffic`
2. **Reduce refresh frequency**: The dashboard already uses 2-minute intervals
3. **Check for multiple tabs**: Multiple dashboard tabs multiply the requests

## Monitoring

Rate limit headers are included in responses:

- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Time when the rate limit resets

## Custom Configuration

For custom needs, manually set environment variables:

```env
# 30-minute window with higher limits
RATE_LIMIT_WINDOW_MS=1800000
RATE_LIMIT_MAX=500
ADMIN_RATE_LIMIT_MAX=2500
```

Remember to restart the server after configuration changes.