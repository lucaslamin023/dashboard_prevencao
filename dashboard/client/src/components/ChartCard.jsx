import React from 'react';
import { Card, CardHeader, CardContent, Typography, Box, Skeleton } from '@mui/material';

export default function ChartCard({
  title,
  subtitle,
  action,
  height = 340,
  loading = false,
  children,
}) {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader
        title={
          <Typography variant="h4" fontWeight={700}>
            {title}
          </Typography>
        }
        subheader={
          subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.3 }}>
              {subtitle}
            </Typography>
          )
        }
        action={action}
        sx={{ pb: 1 }}
      />
      <CardContent sx={{ flex: 1, p: 2, pt: 0, '&:last-child': { pb: 2 } }}>
        <Box sx={{ width: '100%', height, position: 'relative' }}>
          {loading ? (
            <Skeleton
              variant="rectangular"
              width="100%"
              height="100%"
              sx={{ borderRadius: 2 }}
            />
          ) : (
            children
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
