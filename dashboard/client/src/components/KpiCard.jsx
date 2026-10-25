import React from 'react';
import { Card, CardContent, Typography, Box, Skeleton, Chip } from '@mui/material';
import { ResponsiveContainer, LineChart, Line } from 'recharts';

export default function KpiCard({
  title,
  value,
  subtitle,
  badge,
  badgeColor = 'default',
  icon: Icon,
  color = '#22D3EE',
  loading = false,
  sparklineData = null,
}) {
  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
        borderLeft: `4px solid ${color}`,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: (theme) =>
            theme.palette.mode === 'dark'
              ? `0 8px 20px -4px rgba(0, 0, 0, 0.4), 0 0 12px ${color}22`
              : '0 8px 20px -4px rgba(0, 0, 0, 0.1)',
        },
      }}
    >
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography variant="body2" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing={0.5}>
            {title}
          </Typography>
          {Icon && (
            <Box
              sx={{
                p: 0.8,
                borderRadius: '8px',
                backgroundColor: `${color}18`,
                color: color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon fontSize="small" />
            </Box>
          )}
        </Box>

        {loading ? (
          <Skeleton variant="text" width="60%" height={48} />
        ) : (
          <Typography variant="h3" fontWeight={700} sx={{ color: 'text.primary', mb: 0.5, letterSpacing: -0.5 }}>
            {value}
          </Typography>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
          {badge && (
            <Chip
              label={badge}
              size="small"
              sx={{
                fontSize: '0.72rem',
                height: 20,
                fontWeight: 700,
                backgroundColor: `${color}22`,
                color: color,
              }}
            />
          )}
          {subtitle && (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>

        {sparklineData && sparklineData.length > 0 && (
          <Box sx={{ width: '100%', height: 40, mt: 1.5 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparklineData}>
                <Line
                  type="monotone"
                  dataKey="faturamento"
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
