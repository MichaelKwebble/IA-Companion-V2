import React from 'react';
import './Badge.css';

interface BadgeProps {
    children: React.ReactNode;
    variant?: 'neutral' | 'primary' | 'success' | 'warning' | 'error';
    size?: 'sm' | 'md';
}

const Badge: React.FC<BadgeProps> = ({
    children,
    variant = 'neutral',
    size = 'sm'
}) => {
    return (
        <span className={`badge-component ${variant} ${size}`}>
            {children}
        </span>
    );
};

export default Badge;
